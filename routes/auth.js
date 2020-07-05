const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const User = mongoose.model('User')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {JWT_SECRET} = require('../config/keys')
const requireLogin = require('../middleware/requireLogin')
const nodemailer = require('nodemailer')
const sendgridTransport = require('nodemailer-sendgrid-transport')
const {SENDGRID_API,EMAIL} = require('../config/keys')


const transporter = nodemailer.createTransport(sendgridTransport({
    auth:{
        api_key:SENDGRID_API
    }
}))

router.post('/signup', (req,res) => {
    const {name,email,password,pic} = req.body
    if(!email || !password || !name){
        return res.status(422).json({error:"Please add all the fields"})
    }
    User.findOne({email:email})
    .then((savedUser) => {
        if(savedUser){
            res.status(422).json({error:"User already exits with that email"})
        }
        bcrypt.hash(password,12)
        .then(hashedpassword => {
            const user = new User({
                email,
                password:hashedpassword,
                name,
                pic
            })
    
            user.save()
            .then(user => {
                transporter.sendMail({
                    to:user.email,
                    from:"zistebimle@enayu.com",
                    subject:"Sign Up Success",
                    html:`
                    <h1>Welcome to Instagram Clone</h1>
                    <p>
                        Hello ${user.name}!
                    </p>
                    <p>
                        You can now access all the features of this clone
                    </p>
                    `
                })
                res.json({message:"Saved successfully"})
            })
            .catch(err => {
                console.log(err)
            })
        })
        
    })
    .catch(err => {
        console.log(err)
    })
})

router.post('/login', (req,res) => {
    const {email,password} = req.body
    if(!email || !password){
        return res.status(422).json({error: "Please add email or password"})
    }
    User.findOne({email:email})
    .then(savedUser => {
        if(!savedUser){
            return res.status(422).json({error:"Invalid email or password"})
        }
        bcrypt.compare(password,savedUser.password)
        .then(doMatch => {
            if(doMatch){
                const token = jwt.sign({_id:savedUser._id}, JWT_SECRET)
                const {_id,name,email,followers,following,pic} = savedUser
                res.json({token,user:{_id,name,email,followers,following,pic}})
            }
            else{
                return res.status(422).json({error:"Invalid email or password"})
            }
        })
        .catch(err => {
            console.log(err)
        })
    })
})

router.post('/reset-password',(req,res) => {
    crypto.randomBytes(32,(err,buffer) => {
        if(err){
            console.log(err)
        }
        const token = buffer.toString("hex")
        User.findOne({email:req.body.email})
        .then(user => {
            if(!user){
                return res.status(422).json({error:"User doesn;t exist with that email"})
            }
            user.resetToken = token
            user.expireToken = Date.now() + 3600000
            user.save().then((result) => {
                transporter.sendMail({
                    to:user.email,
                    from:"zistebimle@enayu.com",
                    subject:"Password Reset",
                    html:`
                    <p>You requested for password reset </p>
                    <h5>
                        Click this <a href="${EMAIL}/reset/${token}">link</a> to reset password
                    </h5>
                    <br />
                    <p>P.S. This link expires in 1 hour</p>
                    `
                })
                res.json({message:"Check your email"})
            })
            .catch(err => {
                console.log(err)
            })
        })
    })
})

router.post('/new-password',(req,res) => {
    const newPassword = req.body.password
    const sentToken = req.body.token
    User.findOne({resetToken:sentToken,expireToken:{$gt:Date.now()}})
    .then(user => {
        if(!user){
            return res.status(422).json({error:"Try again. Session expired"})
        }
        bcrypt.hash(newPassword,12).then(hashedpassword => {
            user.password = hashedpassword
            user.resetToken = undefined
            user.expireToken = undefined
            user.save().then((savedUser) => {
                res.json({message: "Password Updated Successfully"})
            })
        })
    }).catch(err => {
        console.log(err)
    })
})


module.exports = router