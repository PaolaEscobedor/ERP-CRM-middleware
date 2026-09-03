const sql= require('mssql');
const { getConnection } = require('../models/db');
const axios= require('axios');

// import zohoAuth

const {getAccessToken}= require('../services/zohoAuth');
require('dotenv').config();



async function syncPriceBookDetails() {
    let pool;
    try {
        console.log('Connecting to ERP DB');
        pool= await getConnection();

        if (!pool){
            throw new Error('Not able to connect pool with database');
        }

        console.log('Extracting Price book details catalog, Table ListaPreciosD');
        const result= await pool.request().query(
             `SELECT 
                Lista, Articulo, Precio, Moneda
            FROM ListaPreciosD 
            Where Precio IS NOT NULL AND Precio > 0 
        `);  
        
        
        const PriceERP= result.recordset;
        console.log(`Found ${PriceERP.length} Price Book Details  in ERP`);

        if (PriceERP.length==0) return;

        console.log('Authtemticating with Zoho CRM');
        const { accessToken, apiDomain } = await getAccessToken();
        const zohoApiUrl = `${apiDomain}/crm/v8`;
        const headers = {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        };


         // Helper Fetchmap: for Lookups accounts (Cte) and Proce books (ListaPreciosEsp)

        const fetchMap = async (moduleAPIName, keyField) => {
            const map = {};
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                try {
                    const res = await axios.get(`${zohoApiUrl}/${moduleAPIName}?fields=id,${keyField}&page=${page}&per_page=200`, { headers });
                    if (res.data && res.data.data) {
                        res.data.data.forEach(item => {
                            if (item[keyField]) {map[String(item[keyField]).trim()] = item.id;}
                        });
                        hasMore = res.data.info.more_records;
                        page++;
                    } else {
                        hasMore = false;
                    }
                } catch (err) {
                    console.error(`Erros ecxtracting map ${moduleAPIName}:`, err.message);
                    hasMore=false;
                }
            }
            return map;
        };


        const [priceBooksMap, productsMap] = await Promise.all([
            fetchMap('Price_Books', 'Name'),
            fetchMap('Products', 'Product_Code')
        ]);

        console.log('Maped price books: ', Object.keys(priceBooksMap).length, priceBooksMap);


    // Group Prodcuts and Prices by priceBook
    const priceByBook={};
    PriceERP.forEach(row => {
        const pbID= priceBooksMap[String(row.Lista).trim()];
        const prodID= productsMap[String(row.Articulo).trim()];

        if (pbID && prodID) {
            if (!priceByBook[pbID]) priceByBook[pbID] =[];
            priceByBook[pbID].push({
                id: prodID,
                list_price: parseFloat(row.Precio)
            });
        }

    });

    
    // Send PUT requests to Zoho CRM in 100 elements chuncks 

    console.log(`Updating Prices un zoho CRM`);
    for (const [pbID, products] of Object.entries(priceByBook)) {
        const chunkSize= 100;
        for (let i=0; i < products.length; i += chunkSize) {
            const chunk = products.slice(i, i + chunkSize);
            const url= `${zohoApiUrl}/Price_Books/${pbID}/Products`;

            try {
                await axios.put(url, {data: chunk}, {headers});
                console.log(`List ID ${pbID}: ${chunk.length} prices updated`);

            } catch (err) {
                console.error(`Error updating chunk ID List ${pbID}:`, err.response ? err.response.data : err.message);
            }
        }
    }

   
        
    console.log(`Sinchronyzation succesfullly`);
        

    } catch (error) {
        console.error('Error in sunchronization process: ', error.message);
    } finally {
        // close connection for liberating memory
        if (pool){
            await pool.close();
            console.log('DB Connection closed')
        }
    }
    

        

    
    
}

syncPriceBookDetails();
