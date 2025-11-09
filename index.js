const express = require('express')
const app = express()
require("dotenv").config()
const cors = require("cors")
const port = process.env.PORT || 4000
const { MongoClient, ServerApiVersion } = require('mongodb');


// middleware
app.use(cors())
app.use(express.json())

// mongodb connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0zyxsoe.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})


const run = async () => {
    try {
        // await client.connect()

        const db = client.db("book-haven")
        const booksCollection = db.collection('books')


        app.get('/books', async (req,res) => {
            const result = await booksCollection.find().toArray()
            res.send(result)
        });

        app.post('/books', async(req,res) => {
            const data = req.body
            const result = await booksCollection.insertOne(data)
            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}

run()

app.get('/', (req, res) => {
    res.send("Server is running fine!!!")
})



app.listen(port, () => {
    console.log(`http://localhost:${port}`);

})