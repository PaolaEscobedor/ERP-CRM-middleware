const express= require('express')
const router = express.Router()

const {getConnection} = require('../models/db')








// GET1:  Read and fetch clients from Intelisis, table Cte

router.get('/',  async (req,res) => {  
    try{
        const pool = await getConnection();

        const result= await pool.request().query(
            `Select top 5 
                Cliente as ClientID, 
                Nombre as name,
                CodigoPostal as zipCode,
                RFC as taxId,
                Estatus as status,
                Grupo as [Group]
            FROM Cte`
            );
            res.status(200).json({
            message: 'Data extraction successful',
            count: result.recordset.length,
            data: result.recordset
        });

    }catch(err){
        console.error('Error fetching clients: ', err.message);
        res.status(500).json({message:err.message});
    }
});



// // GET2: Search posts By parameters (keywords, date, or owner)
// router.get('/search', verify, async(req, res) => {
//      try{
//         // extract params from URL with req,query
//         const{keyword, owner, startDate, endDate}= req.query;

//         // to store query filters
//         let queryfilters = {};

//         // A. search by owner
//         if (owner) {
//             queryfilters.post_owner = owner;
        
//         }


//         // B. search by date range
//         if (startDate && endDate) {
//             // create new object to include all hours from endDate and avoid user to input the hour
//             const end = new Date(endDate);
//             end.setUTCHours(23,59, 59, 999);
//             queryfilters.post_time = {
//                 $gte: new Date(startDate), // greater or equal than startDate
//                 $lte: end, // Less or equal than endDate
//             };
//         }

//         // C. search by keyword using denormalized table

//         if(keyword) {
//             // use $regex to find parcial matches contained in the keyword 
//             const searchResults = await Search.find({
//                 keyword: { $regex: keyword.toLowerCase(), $options: 'i'}
//             });
//             // extract ids that match search
//             const matchedPostIds = searchResults.map(result => result.post_id);

//             // use query filters to tell BD to bring IDs
//             queryfilters._id = { $in: matchedPostIds};
         
//         }

//         const posts = await Post.find(queryfilters);

//         res.send(posts);

//     } catch (err) {
//         res.status(400).send({ message: err.message });
//     }
// });


        



// // Get3 data (by ID)

// router.get('/:postID', verify, async(req, res) => {
//      try{
//         const getPostByID= await Post.findById(req.params.postID)
//         res.send(getPostByID)
//     }catch(err){
//         res.status(400).send({message:err.message})
//     }
// }
// )


// // PATCH (update data) Only owners of the post can update 

// router.patch('/:postID', verify, async(req,res)=>{

//     try{
//         const updatePostByID= await Post.updateOne(
//             {_id:req.params.postID,
//              post_owner: req.user._id
//             },
//             {$set:{
//                 post_title:req.body.post_title,
//                 post_description: req.body.post_description,
//                 hashtag:req.body.hashtag,
//                 url:req.body.url
//                 }
//             }

//         );

//         if(updatePostByID.matchedCount===0){
//             return res.status(403).send({message: "You are not allowed to update this post, or it doesn't exist"});
//         }

//         res.send({message: "Post updated succesfully"});
//     }catch(err){
//         res.status(400).send({message:err})
//     }
// })


// // DELETE:  Only Users can delete  their own Posts

// router.delete('/:postID', verify, async(req,res)=>{
//     try{
//             const deletePostByIDandUser= await Post.deleteOne({
//                 _id:req.params.postID,
//                 post_owner: req.user._id
//             });

//             //if deletedCount is 0, no post with those conditions was found
//             if (deletePostByIDandUser.deletedCount===0) {
//                 return res.status(403).send({message: "You are not allowed to delete this post, or it doesn't exist"});
//             }
//             res.send({message: "Post deleted succesfully"});
//         }catch(err){
//                 res.status(400).send({message:err})
//         }
//     })




//  //INTERACTION SERVICES, like and comment   
// // POST: Like a post

// router.post('/:postID/like', verify, async(req, res) =>{
//     //try to like
//     try{
//         // 1. find post and its likes
//         const postToFind= await Post.findById(req.params.postID);
//         if (!postToFind){
//             return res.status(404).send({message: "Post not found" });
//         }
//         // 2. Owner cannot like his own post
//         if (postToFind.post_owner === req.user._id) {
//             return res.status(403).send({message: "You cannot like your own post" });
//         }
//         // 3. Verify if one user has already liked the post
//         if (postToFind.likes.includes(req.user._id)){
//             return res.status(400).send({message: "You already liked this post" });
//         }

//         const updateLike = await Post.updateOne(
//             { _id: req.params.postID },
//             { $push: { likes: req.user._id } }
//         );

//         res.send({message: "Post liked succesfully"});

//     }catch(err){
//         res.status(400).send({message:err.message})
//     }
// })



// // POST: comment a post

// router.post('/:postID/comment', verify, async(req, res) =>{
//     //try to comment
//     try{
//         // 1. Validate comment, not empty
//         if (!req.body.comment_text|| req.body.comment_text.trim() ==='') {
//             return res.status(400).send({message: "Comment text is required" });

//         }
//         // 2. Find the post
//         const postToFind= await Post.findById(req.params.postID);
//         if (!postToFind){
//             return res.status(404).send({message: "Post not found" });
//         }
//         // 2. Owner cannot like his own post
//         if (postToFind.post_owner === req.user._id) {
//             return res.status(403).send({message: "You cannot comment your own post" });
//         }

//         // create the new comment
//         const newComment =  {
//              user_id: req.user._id,
//              comment_text: req.body.comment_text
            
//         };
        
//         // 3. Add comment to comments array

//         const updateComment = await Post.updateOne(
//             { _id: req.params.postID },
//             { $push: { comments: newComment} }
//         );
            

//         res.send({message: "Comment added succesfully"});

//     }catch(err){
//         res.status(400).send({message:err.message})
//     }

// })


// // GET. List a post comments


// router.get('/:postID/comments', verify, async(req, res) =>{
//     //try to list comments
//     try{
//         // 1. Find Post
//         const postToFind= await Post.findById(req.params.postID);

//         if (!postToFind){
//             return res.status(404).send({message: "Post not found" });
//         }           

//         res.send(postToFind.comments);

//     }catch(err){    
//         res.status(400).send({message:err.message})
//     }

// })








  



module.exports = router
