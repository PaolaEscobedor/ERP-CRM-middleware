const sql= require('mssql');
const { getConnection } = require('../models/db');
const axios= require('axios');

// import zohoAuth

const {getAccessToken}= require('../services/zohoAuth');
require('dotenv').config();

/**
 * Synchronizes Prodcut data from Intelisis ERP (Table: Art) to Zoho CRM.
 */

async function syncProducts() {
    let pool;
    try {
        console.log('Connecting to ERP DB');
        pool= await getConnection();

        if (!pool){
            throw new Error('Not able to connect pool with database');
        }

        console.log('Extracting Products catalog, Table Art');
        const result= await pool.request().query(
             `SELECT 
                Articulo, Descripcion1, Estatus, Unidad, Peso, Volumen,
                Linea, Categoria, Familia, Grupo, Fabricante, Impuesto1
            FROM Art 
            WHERE Estatus = 'ALTA'
        `);  
        
        
        const ERPProducts= result.recordset;
        console.log(`Found ${ERPProducts.length} Products in ERP`);

        if (ERPProducts.length==0) return;

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
                    // 
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
        lineMap,
        manufacturerMap,
               
        ] = await Promise.all([
        fetchMap('prod_category'),
        fetchMap('prod_group'),
        fetchMap('prod_family'),
        fetchMap('prod_line'),
        fetchMap('prod_manufacturer')
    ]);

        // Verify logs  
        console.log('Line maps:',lineMap);
        console.log('Category maps:',categoryMap);



     // -----------------------------------------------------------------
     // DATA TRANSFORMATION ETL (Transform data)
     // MAP raw ERP fields to Zoho CRM Accoounst API structure
     // -----------------------------------------------------------------

     // LOOKUP FIELDS (Resolved dynamically via dictionary maps)
        const payloadZoho={
            data: ERPProducts.map(Prod =>({
                Product_Name: Prod.Descripcion1,
                Product_Code: Prod.Articulo,
                Usage_Unit: Prod.Unidad,
                Status: Prod.Estatus,
                weight: Prod.Peso,
                volume: Prod.Volumen,
                tax1: Prod.Impuesto1,
                prod_line: Prod.Linea ? (lineMap[String(Prod.Linea)] || null) : null,
                prod_category:  Prod.Categoria ? (categoryMap[String(Prod.Categoria)] || null) : null,
                prod_family: Prod.Familia ? (familyMap[String(Prod.Familia)] || null) : null,
                prod_group: Prod.Grupo ? (groupMap[String(Prod.Grupo)] || null) : null,
                manufacturer_erp: Prod.Fabricante ? (manufacturerMap[String(Prod.Fabricante)] || null) : null,
                
            })), 
            duplicate_check_fields: ["Product_Code"]
        };


        // -----------------------------------------------------------------
        // EXECUTE UPSERT
        // -----------------------------------------------------------------

        console.log('Executing Upsert in CRM');
        const ModuleAPIName='Products';

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

syncProducts();
