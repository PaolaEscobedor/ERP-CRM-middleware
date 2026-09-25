const axios = require('axios');
const { getAccessToken } = require('../services/zohoAuth');

const BATCH_SIZE = 100; // Zoho CRM upsert limit per request

/**
 * Destination Adapter: Zoho CRM
 * ------------------------------------------------------
 * Responsible for translating Canonical Data Model records
 * into Zoho CRM payloads and pushing them via the REST API.
 * This adapter has NO knowledge of Intelisis or SQL Server —
 * it only understands the CDM and the config's destinationMap.
 */


class ZohoAdapter {
    constructor() {
        this.apiDomain = null;
        this.headers = null;
    }

    async initialize() {
        const {accessToken, apiDomain} = await getAccessToken();
        this.apiDomain = apiDomain;
        this.headers = {
             'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        };
    }

     /**
     * Fetches a { externalKeyValue: zohoRecordId } map from a Zoho
     * module, following pagination until all records are retrieved.
     */

     async fetchMap(moduleAPIName, keyField= 'Codigo_ERP') {
        if(!this.headers) await this.initialize();

        const map = {};
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response= await axios.get(`${this.apiDomain}/crm/v8/${moduleAPIName}?fields=id,${keyField}&page=${page}&per_page=200`, { headers: this.headers }
                );
                (response.data.data || []).forEach((item) => {
                    const key = item[keyField];
                    if (key !== undefined && key !== null && key !== '') { map[String(key)] = item.id;
                    }
                });
                hasMore = response.data.info.more_records;
                page++;

            } catch (error) {
             console.warn(`Error fetching map for module ${moduleAPIName} on page ${page}:`, error.message);
                hasMore = false; // stop on error
            }
        }

        return map;
    }


    /**
     * Special-case lookup for Zoho users, indexed by "alias"
     * instead of "Codigo_ERP" (used for Owner/Agent fields)
     *  In Zoho it is not possible to create a user with a custom "Codigo_ERP", so we use the "alias" field instead.
     */


    async fetchUsersMap()  {
        if(!this.headers) await this.initialize();

        const map = {};
        const response = await axios.get(`${this.apiDomain}/crm/v8/users`, { headers: this.headers });
        if (response.data && response.data.users) {
            response.data.users.forEach((user) => {
                if (user.alias) map[String(user.alias)] = user.id;
            });
        return map;
        }
    
    }


    /**
        * Builds a reverse lookup map: { zohoUserId: alias }
        * Used to translate a Sales Order's record Owner into the
        * Intelisis agent code (Alias), the inverse of fetchUsersMap().
    */
    async fetchUsersReverseMap() {
        if (!this.headers) await this.initialize();

            const map = {};
            const response = await axios.get(`${this.apiDomain}/crm/v8/users`, { headers: this.headers });
            (response.data?.users || []).forEach(user => {
            if (user.alias) map[String(user.id)] = String(user.alias);
        });
        return map;
    }


    /**
     * Resolves all lookups declared in config.lookups (and any
     * config.specialLookups), returning a map of maps keyed by
     * destination field name.
     */

    async _resolveLookups(config) {
        const maps= {};

        await Promise.all(config.lookups.map(async l => {
            maps[l.field] = await this.fetchMap(l.zohoModule, l.keyField || 'Codigo_ERP');
        }));

        if (config.specialLookups) {
            await Promise.all(Object.entries(config.specialLookups).map(async([field, spec]) => {
                if (spec.endpoint === 'users') {
                    maps[field] = await this.fetchUsersMap();
                } 

            }));
        
        }
        return maps;
    }


    /**
    * Translates canonical records into Zoho payloads using
    * config.destinationMap, then pushes them in batches of 100.
    * @param {object[]} canonicalRecords
    * @param {object} config
    */

    async pushCanonical (canonicalRecords, config) {
        if(!this.headers) await this.initialize();

        const maps = await this._resolveLookups(config);

        // Debugging: log the lookup maps and canonical records
        // console.log('Branches map keys:', Object.keys(maps['SucursalEmpresa'] || {}));
        // console.log('Sample canonical branch values:', canonicalRecords.slice(0, 3).map(r => r.branch));

        const records= canonicalRecords.map(rec => {
            const record = {};
            for (const[destField, mapping] of Object.entries(config.destinationMap)) {
                record[destField]= mapping.lookup ? (maps[destField]?.[String(rec[mapping.canonical]).trim()] || null)
                : rec[mapping.canonical];
            }
            return record;
        });

        let syncedCount = 0;
        let errorCount = 0;

        let totalUpserted = 0;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const chunk = records.slice(i, i + BATCH_SIZE);
            const response = await axios.post(
                `${this.apiDomain}/crm/v8/${config.zohoModule}/upsert`,
                { data: chunk, duplicate_check_fields: config.duplicateCheckFields },
                { headers: this.headers }
            );
            response.data.data.forEach(item => {
                if (item.status === 'error') {
            errorCount++;
            console.warn(` Error: ${item.message}`);
            console.warn(`     Details:`, JSON.stringify(item.details));
                } else {
                    syncedCount++;
                    console.log(`  Record ID: ${item.details.id} | Action: ${item.action}`);
                }
            });
            console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} synced (${chunk.length} records) -> ${config.zohoModule}`);
        

        }
        return { syncedCount, errorCount, expectedCount: records.length };
    }



    /** Functions required for the Zoho - ERP direction**/


    /**
    * Fetches a single record by ID from a Zoho module, with all its
    * native fields (used to retrieve a Sales Order after Deluge sends
    * only its record ID).
    */

    async getRecord(moduleAPIName, recordId) {
        if(!this.headers) await this.initialize();

        try{
            const response= await axios.get(
                `${this.apiDomain}/crm/v8/${moduleAPIName}/${recordId}`,
                { headers: this.headers }
            );
            return response.data?.data?.[0] || null;
        } catch (error) {
            console.error(`Error fetching record ${recordId} from ${moduleAPIName}:`, error.response?.data || error.message);
            throw error;
        }
    }



    /**
    * Builds a reverse lookup map: { zohoRecordId: Codigo_ERP }
    * Used when translating FROM Zoho (lookup fields return Zoho record
    * IDs) TO Intelisis (the SP expects the original ERP code).
    */

    async fetchReverseMap(moduleAPIName, keyField='Codigo_ERP'){
        if (!this.headers) await this.initialize();

        const map={};
        let page=1;
        let hasMore= true;

        while (hasMore){
            try{
                const response= await axios.get(
                    `${this.apiDomain}/crm/v8/${moduleAPIName}?fields=id,${keyField}&page=${page}&per_page=200`,
                    { headers: this.headers }
                );
                (response.data?.data || []).forEach((item) => {
                    const code = item[keyField];
                    if( code !== undefined && code !== null && code !== ''){
                        map[String(item.id)]= String(code).trim();
                    }
                });
                hasMore= !!response.data?.info?.more_records;
                page ++;         
            } catch (error){
                console.warn('Error fetching reverse map for module ${moduleAPIName} on page ${page}:', error.message);
                hasMore=false;
            }
        }

        return map;
    }


    /**
    * Translates a raw Zoho record into the Canonical Data Model (CDM)
    * using config.sourceMap, resolving lookup fields (which come back
    * as { id, name } objects) via config.reverseLookups.
    */

    async buildCanonicalFromZohoRecord(zohoRecord, config){

        const reverseMaps= {};
        await Promise.all((config.reverseLookups || []).map(async (rl) => {
            reverseMaps[rl.field] = await this.fetchReverseMap(rl.zohoModule, rl.keyField);
        }));

        if (config.specialReverseLookups) {
            await Promise.all(Object.entries(config.specialReverseLookups || []).map(async ([field, spec]) => {
                if (spec.endpoint === 'users'){
                    reverseMaps[field] = await this.fetchUsersReverseMap();
                }
            }));
            
        }   

        const canonical= {};
        for (const[canonicalField, mapping] of Object.entries(config.sourceMap)){
            const rawValue= zohoRecord[mapping.zohoField];

            if (reverseMaps[canonicalField]){
                const zohoLookupID= rawValue?.id || rawValue;
                canonical[canonicalField]= zohoLookupID ? (reverseMaps[canonicalField][String(zohoLookupID)] || mapping.defaultValue || null)
                : (mapping.defaultValue || null);
            } else if(mapping.transform) {
                canonical[canonicalField] = mapping.transform(rawValue);
            } else {
                canonical[canonicalField]= rawValue ?? mapping.defaultValue ?? null;
            }
        }

        return canonical;
    
    }




}






module.exports = ZohoAdapter;



