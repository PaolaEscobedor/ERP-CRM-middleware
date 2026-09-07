const sql= require('mssql');
const { getConnection } = require('../../models/db');
const axios= require('axios');

// import zohoAuth

const {getAccessToken}= require('../../services/zohoAuth');
require('dotenv').config();



async function syncSalesPaymentForms() {
    let pool;
    try {
        console.log('Connectong to ERP DB');
        pool= await getConnection();

        if (!pool){
            throw new Error('Not able to connect pool with database');
        }

        console.log('Extracting Currency catalog, Table Mon');
        const result= await pool.request().query(
             `SELECT 
                FormaPago 
            FROM FormaPago
        `);  
        
        
        const PaymentForm= result.recordset;
        console.log(`Found ${PaymentForm.length} sales payment forms in ERP`);

        if (PaymentForm.length==0) return;

        console.log('Authtemticating with Zoho CRM');
        const { accessToken, apiDomain } = await getAccessToken();
        const zohoApiUrl = `${apiDomain}/crm/v8`;

        // ETL (Transform data)
        const payloadZoho={
            data: PaymentForm.map(Form =>({
                Name: Form.FormaPago,
                Codigo_ERP: Form.FormaPago,
  

                
            })), 
            duplicate_check_fields: ["Codigo_ERP"]
        };

        console.log('Executing Upsert in CRM');
        const ModuleAPIName='sales_payment_form';

        const response = await axios.post(`${zohoApiUrl}/${ModuleAPIName}/upsert`, payloadZoho, {
            headers:{
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('------------- SYNCH RESULTS -------------');
        response.data.data.forEach(element => {
            console.log('Record ID: ${element.details.id} Action: ${element.action} ');
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

syncSalesPaymentForms();
