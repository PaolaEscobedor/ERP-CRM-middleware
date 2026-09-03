const sql= require('mssql');
const { getConnection } = require('../models/db');
const axios= require('axios');

// import zohoAuth

const {getAccessToken}= require('../services/zohoAuth');
require('dotenv').config();

/**
 * Synchronizes Customer data (Accounts) from Intelisis ERP (Table: Cte) to Zoho CRM.
 */

async function syncAccounts() {
    let pool;
    try {
        console.log('Connecting to ERP DB');
        pool= await getConnection();

        if (!pool){
            throw new Error('Not able to connect pool with database');
        }

        console.log('Extracting Accounts catalog, Table Cte');
        const result= await pool.request().query(
             `SELECT 
                Cliente, Nombre, eMail1, RFC, Telefonos, 
                Direccion, Poblacion, Estado, CodigoPostal, Pais, 
                ListaPreciosEsp, Condicion, CreditoLimite, 
                AlmacenDef, Categoria, Grupo, Familia, FiscalRegimen, Descuento,
                Agente
            FROM Cte 
            WHERE Estatus = 'ALTA'
        `);  
        
        
        const ERPAccounts= result.recordset;
        console.log(`Found ${ERPAccounts.length} Accounts in ERP`);

        if (ERPAccounts.length==0) return;

        console.log('Authtemticating with Zoho CRM');
        const { accessToken, apiDomain } = await getAccessToken();
        const zohoApiUrl = `${apiDomain}/crm/v8`;

        const headers = {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        };



        // -----------------------------------------------------------------
        //  PARALLEL LOOKUP MAP RESOLUTION
        // Helper function to fetch custom catalog records from Zoho 
        // and create an in-memory map: { "Codigo_ERP": "Zoho_Record_ID" }
        // -----------------------------------------------------------------


        const fetchMap= async (moduleAPIName) => {
            try {
                const res = await axios.get(`${zohoApiUrl}/${moduleAPIName}?fields=id,Codigo_ERP`, { headers });
                const map= {};
                if (res.data && res.data.data) {
                    res.data.data.forEach(item => map[String(item.Codigo_ERP)]= item.id);
                }
                return map;
                
            } catch (err) {
                console.warn(`Could not lookup map for module '${moduleAPIName}':`, err.message);
                return {};
            }
        };


    // download all eference catalogs 

    const [
        categoryMap,
        groupMap,
        familyMap,
        paymentTermsMap,
        priceListMap,
        warehouseMap, 
        usersRes        
        ] = await Promise.all([
        fetchMap('account_category'),
        fetchMap('account_group'),
        fetchMap('account_family'),
        fetchMap('sales_payment_terms'),
        fetchMap('Price_Books'),
        fetchMap('sales_warehouses'),
        axios.get(`${zohoApiUrl}/users`, { headers })
    ]);

    //For users, transform the users request  in the map using Alias field 

    const usersMap= {};
    if (usersRes.data && usersRes.data.users) {
        usersRes.data.users.forEach(user=> {
            if (user.alias) {
                usersMap[String(user.alias)] = user.id;
            }
            });
    }


     // -----------------------------------------------------------------
     // DATA TRANSFORMATION ETL (Transform data)
     // MAP raw ERP fields to Zoho CRM Accoounst API structure
     // -----------------------------------------------------------------

     // LOOKUP FIELDS (Resolved dynamically via dictionary maps)
        const payloadZoho={
            data: ERPAccounts.map(Account =>({
                Account_Name: Account.Nombre,
                Codigo_ERP: Account.Cliente,
                email_1: Account.eMail1,
                tax_id: Account.RFC,
                Phone: Account.Telefonos,
                Billing_Street: Account.Direccion,
                Billing_City: Account.Poblacion,
                Billing_State: Account.Estado,
                Billing_Code: Account.CodigoPostal,
                Billing_Country: Account.Pais,
                price_list: Account.ListaPreciosEsp ? (priceListMap[String(Account.ListaPreciosEsp)] || null) : null,
                payment_terms:  Account.Condicion ? (paymentTermsMap[String(Account.Condicion)] || null) : null,
                credit_limit: Account.CreditoLimite,
                default_warehouse: Account.AlmacenDef ? (warehouseMap[String(Account.AlmacenDef)] || null) : null,
                account_category: Account.Categoria ? (categoryMap[String(Account.Categoria)] || null) : null,
                account_group: Account.Grupo ? (groupMap[String(Account.Grupo)] || null) : null,
                account_family: Account.Familia ? (familyMap[String(Account.Familia)] || null) : null,
                tax_regime: Account.FiscalRegimen,
                discount_percentage: Account.Descuento,
                Owner: Account.Agente ? (usersMap[String(Account.Agente)] || null) : null,
                ERP_Agent: Account.Agente || null
            })), 
            duplicate_check_fields: ["Codigo_ERP"]
        };

        // -----------------------------------------------------------------
        // EXECUTE UPSERT
        // -----------------------------------------------------------------

        console.log('Executing Upsert in CRM');
        const ModuleAPIName='Accounts';

        const response = await axios.post(`${zohoApiUrl}/${ModuleAPIName}/upsert`, payloadZoho, {
            headers:{
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('------------- SYNCH RESULTS -------------');
        response.data.data.forEach(element => {
            console.log(`Record ID: ${element.details.id} Action: ${element.action} `);
        });

    } catch (error) {
        console.error('Error executing synCondicion: ', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        // close connection for liberating memory
        if (pool){
            await pool.close();
            console.log('DB Connection closed')
        }
    }
    

        

    
    
}

syncAccounts();
