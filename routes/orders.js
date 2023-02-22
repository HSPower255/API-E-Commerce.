const {Order} = require('../models/order');
const {OrderItem} = require('../models/order-item');
const express = require('express');
const router = express.Router();


//GET ORDER LIST
router.get(`/`, async (req, res) =>{
    const orderList = await Order.find()
    .populate('user', 'name').sort({'dateOrdered': -1})
    .populate({ path: 'orderItems', populate: { path: 'product', populate: 'category'}})

    if(!orderList) {
        res.status(500).json({success: false})
    } 
    res.send(orderList);
})


//GET ORDER BY ID
router.get(`/:id`, async (req, res) =>{
    const order = await Order.findById(req.params.id).populate('user', 'name')

    if(!order) {
        res.status(500).json({success: false})
    } 
    res.send(order);
})


//NEW ORDER
router.post('/', async (req,res)=>{
    const orderItemsIds = Promise.all(req.body.orderItems.map(async orderItem => {
        let newOrderItem = new OrderItem({
            quantity: orderItem.quantity,
            product: orderItem.product,
        })
        newOrderIten = await newOrderItem.save()
        return newOrderItem._id
    }))
    const orderItemsIdsResolved = await orderItemsIds

    const totalPrices = await Promise.all(orderItemsIdsResolved.map(async (orderItemId) => {
        const orderItem = await OrderItem.findById(orderItemId).populate('product', 'price')
        const totalPrice = orderItem.product.price * orderItem.quantity
        return totalPrice
    }))

    const totalPrice = totalPrices.reduce((a,b) => a + b, 0)

    let order = new Order({
        orderItems: orderItemsIdsResolved,
        shippingAddress1: req.body.shippingAddress1,
        shippingAddress2: req.body.shippingAddress2,
        city: req.body.city,
        zip: req.body.zip,
        country: req.body.country,
        phone: req.body.phone,
        status: req.body.status,
        totalPrice: totalPrice,
        user: req.body.user,
    })
    order = await order.save();

    if(!order)
    return res.status(400).send('Order cannot be created.')

    res.send(order);
})


//UPDATE ORDER STATUS
router.put('/:id',async (req, res)=> {
    const order = await Order.findByIdAndUpdate(
        req.params.id,
        {
            status: req.body.status
        },
        { new: true}
    )

    if(!order)
    return res.status(400).send('Order cannot be updated.')
    
    res.send(order);
})


//DELETE ORDER
router.delete('/:id', (req, res)=>{
    Order.findByIdAndRemove(req.params.id).then(async order =>{
        if(order) {
            await order.orderItems.map(async orderItem => {
                await OrderItem.findByIdAndRemove(orderItem)
            })
            return res.status(200).json({success: true, message: 'Order deleted.'})
        } else {
            return res.status(404).json({success: false , message: 'Order not found.'})
        }
    }).catch(err=>{
       return res.status(500).json({success: false, error: err}) 
    })
})


//GET TOTAL SALES
router.get('/get/totalsales', async (req, res) => {
    const totalSales = await Order.aggregate([
        { $group: { _id: null, totalSales: { $sum: '$totalprice'}}}
    ])
    if(!totalSales) {
        return res.status(400).send('Order sales cannot be generated.')
    }
    res.send({totalSales: totalSales.pop().totalSales})
})


//GET TOTAL ORDERS
router.get(`/get/count`, async (req, res) =>{
    const orderCount = await Order.countDocuments((count) => count)

    if(!orderCount) {
        res.status(500).json({success: false})
    } 
    res.send({ orderCount: orderCount })
})


//USER ORDER LIST
router.get(`/get/userorders/:userid`, async (req, res) =>{
    const userOrderList = await Order.find({user: req.params.userid}).populate({
        path: 'orderItems', populate: {
            path: 'product', populate: 'category'}
    }).sort({'dateOrdered': -1})

    if(!userOrderList) {
        res.status(500).json({success: false})
    } 
    res.send(userOrderList)
})


module.exports = router