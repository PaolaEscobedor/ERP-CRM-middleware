const express= require('express')
const { syncSalesOrder } = require('../sync/salesOrderSync');
const { tokenHandler, requireAuth } = require('../services/auth');

const router = express.Router()

//const {getConnection} = require('../models/db')


// Public: no authentication required
router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.post('/auth/token', tokenHandler);


// Flow B: Zoho Sales Order -> Intelisis
router.post('/sales-orders/:recordId/sync', requireAuth('sales-orders:sync'), async (req, res) => {

    try{
        const {status, result}=await syncSalesOrder(req.params.recordId);

        if (status === 'NOT_FOUND'){
            return res.status(404).json({ error: 'Sales order not found in Zoho' });
        }
        if (status === 'OK') {
            return res.status(200).json(result);
        }
        // Rejected by a business rule (SP validation or non-editable order)
        return res.status(422).json(result);
    } catch (error) {
        return res.status(500).json({error: error.message});
    }
});



module.exports = router;

// TESTS PREVIOUS NOT INCLUDED
// router.get('/',  async (req,res) => {  
//     try{
//         const pool = await getConnection();

//         const result= await pool.request().query(
//             `Select top 5 
//                 Cliente as ClientID, 
//                 Nombre as name,
//                 CodigoPostal as zipCode,
//                 RFC as taxId,
//                 Estatus as status,
//                 Grupo as [Group]
//             FROM Cte`
//             );
//             res.status(200).json({
//             message: 'Data extraction successful',
//             count: result.recordset.length,
//             data: result.recordset
//         });

//     }catch(err){
//         console.error('Error fetching clients: ', err.message);
//         res.status(500).json({message:err.message});
//     }
// });








