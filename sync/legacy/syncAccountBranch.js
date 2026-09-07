const sql= require('mssql');
const { getConnection } = require('../../models/db');
const axios= require('axios');

// import zohoAuth

const {getAccessToken}= require('../../services/zohoAuth');
require('dotenv').config();

/**
 * Synchronizes Account Branches (CteEnviarA) from Intelisis ERP to Zoho CRM.
 */

async function syncAccountBranch() {
    let pool;
    try {
        console.log('Connectong to ERP DB');
        pool= await getConnection();

        if (!pool){
            throw new Error('Not able to connect pool with database');
        }

        console.log('Extracting Account branches, Table CteEnviarA');
        const result= await pool.request().query(
             `SELECT 
                    ID,
                    Nombre, 
                    Cliente,
                    ListaPreciosEsp,
                    Direccion,
                    DireccionNumero, 
                    Poblacion, 
                    CodigoPostal, 
                    Estado, 
                    Pais

                                   
            FROM CteEnviarA
        `);  
        
        
        const Branch= result.recordset;
        console.log(`Found ${Branch.length} Account Branches in ERP`);

        if (Branch.length==0) return;

        console.log('Authtemticating with Zoho CRM');
        const { accessToken, apiDomain } = await getAccessToken();
        const zohoApiUrl = `${apiDomain}/crm/v8`;

        const headers = {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        };

        // Helper Fetchmap: for Lookups accounts (Cte) and Proce books (ListaPreciosEsp)

        const fetchMap = async (moduleAPIName, searchField = 'Codigo_ERP') => {
            try {

                const nameField = moduleAPIName === 'Accounts' ? 'Account_Name' : (moduleAPIName === 'Price_Books' ? 'Price_Book_Name' : 'Name');
                const res = await axios.get(`${zohoApiUrl}/${moduleAPIName}?fields=id,${searchField},${nameField}`, { headers });

                const map= {}
                if (res.data && res.data.data) {
                    res.data.data.forEach(item => {
                        const key = item[searchField] || item[nameField];
                        if (key) map[String(key)] = item.id;
                    });
                }
                return map;
            } catch (err) {
                  console.warn(`Could not lookup map for module '${moduleAPIName}':`, err.message);
                  return {};
            }
        };


        const [accountsMap, priceBooksMap] = await Promise.all([
            fetchMap('Accounts', 'Codigo_ERP'),
            fetchMap('Price_Books', 'Name')
        ]);

        console.log('Maped objects: ', Object.keys(accountsMap).length, accountsMap);



        // ETL (Transform data)
        const payloadZoho={
            data: Branch.map(branch =>{
                // unique ID ERP Cliente_ID
                const erpKey= `${branch.Cliente}_${branch.ID}`;

                return {
                Name: branch.Nombre,
                Codigo_ERP: erpKey,
                Branch_ID: String(branch.ID),
                Account_name: branch.Cliente ? (accountsMap[String(branch.Cliente)] || null) : null,
                Price_Books: branch.ListaPreciosEsp ? (priceBooksMap[String(branch.ListaPreciosEsp)] || null) : null,
                Direcci_n_1_Street_Address: branch.Direccion,
                Direcci_n_1_Flat_House_No_Building_Apartment_Name: branch.DireccionNumero,
                Direcci_n_1_City: branch.Poblacion,
                Direcci_n_1_Zip_Postal_Code: branch.CodigoPostal,
                Direcci_n_1_State_Province:branch.Estado,
                Direcci_n_1_Country_Region: branch.Pais
               };
            }), 
            duplicate_check_fields: ["Codigo_ERP"]
        };

        // Execute Upsert
        console.log('Executing Upsert in CRM');
        const ModuleAPIName='account_branches';

        const response = await axios.post(`${zohoApiUrl}/${ModuleAPIName}/upsert`, payloadZoho, { headers });

        
           
      

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

syncAccountBranch();
