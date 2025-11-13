const express = require('express')
const app = express()
require("dotenv").config()
const cors = require("cors")
const port = process.env.PORT || 4000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const admin = require("firebase-admin");

const serviceAccount = require("./the-book-haven-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
// middleware
app.use(cors())
app.use(express.json())

const verifyFireBaseToken = async (req, res, next) => {

    console.log("in the verify middleware", req.headers.authorization);
    if (!req.headers.authorization) {
        //do not allow
        res.status(401).send({ message: "unauthorized access" })
    }

    const token = req.headers.authorization.split(' ')[1]
    if (!token) {
        return res.status(401).send({ massage: 'unauthorized access' })
    }


    try {
        const userInfo = await admin.auth().verifyIdToken(token)
        console.log("after", userInfo);

        next()
    } catch {
        return res.status(401).send({ massage: 'unauthorized access' })
    }

    // verify token


}

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
        const commentsCollection = db.collection('comment')
        const reviewsCollection = db.collection('reviews')


        app.get('/books', async (req, res) => {
            const result = await booksCollection.find().toArray()
            res.send(result)
        });

        app.post('/books', async (req, res) => {
            const data = req.body
            const result = await booksCollection.insertOne(data)
            res.send(result)
        })

        app.get('/books/:id', async (req, res) => {
            const { id } = req.params
            const objectId = new ObjectId(id)

            const result = await booksCollection.findOne({ _id: objectId })
            res.send(result)
        })

        app.put('/books/:id', async (req, res) => {
            const { id } = req.params
            const data = req.body
            console.log(id)
            console.log(data)
            const objectId = new ObjectId(id)
            const filter = { _id: objectId }
            const update = {
                $set: data,
            }
            const result = await booksCollection.updateOne(filter, update)
            res.send(result)
        })

        app.delete('/books/:id', async (req, res) => {
            const { id } = req.params

            const result = await booksCollection.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        app.get('/my-books', verifyFireBaseToken, async (req, res) => {
            console.log('headers', req.headers);

            const email = req.query.email
            const result = await booksCollection.find({ userEmail: email }).toArray()
            res.send(result)
        })

        app.get('/latest-books', async (req, res) => {
            const result = await booksCollection.find().sort({ created_at: -1 }).limit(6).toArray()
            res.send(result)
        })

        app.get('/asort-rating', async (req, res) => {
            const result = await booksCollection.find().sort({ rating: -1 }).toArray()
            res.send(result)
        })

        app.get('/dsort-rating', async (req, res) => {
            const result = await booksCollection.find().sort({ rating: 1 }).toArray()
            res.send(result)
        })

        app.get('/top-rated', async (req, res) => {
            const result = await booksCollection.find().sort({ rating: -1 }).limit(3).toArray()
            res.send(result)
        })

        app.get('/search', async (req, res) => {
            const search_text = req.query.search
            const result = await booksCollection.find({ title: { $regex: search_text, $options: 'i' } }).toArray()
            res.send(result)
        })

        app.get('/comments', async (req, res) => {
            const productId = req.query.productId
            const result = await commentsCollection.find({ productId: productId }).toArray()
            res.send(result)
        })

        app.post('/comments', async (req, res) => {
            const data = req.body
            const result = await commentsCollection.insertOne(data)
            res.send(result)
        })

        app.get('/reviews', async (req, res) => {
            const productId = req.query.productId
            const result = await reviewsCollection.find({ productId: productId }).toArray()
            res.send(result)
        })



        app.post('/reviews', async (req, res) => {
            try {
                const data = req.body;

                if (typeof data.rating !== 'number') {
                    return res.status(400).send({ ok: false, message: 'rating must be a number' });
                }


                const insertResult = await reviewsCollection.insertOne({
                    ...data,
                    created_at: data.created_at || new Date()
                });


                const productIdRaw = data.productId;
                let tryObjectId = null;
                try {
                    tryObjectId = new ObjectId(productIdRaw);
                } catch (e) {
                    tryObjectId = null;
                }

                const match = tryObjectId
                    ? { $or: [{ productId: productIdRaw }, { productId: tryObjectId }] }
                    : { productId: productIdRaw };


                const agg = [
                    { $match: match },
                    { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
                ];
                const aggRes = await reviewsCollection.aggregate(agg).toArray();
                const stats = aggRes[0] || { avgRating: 0, count: 0 };


                const bookFilter = tryObjectId ? { _id: tryObjectId } : { _id: productIdRaw };
                const newAvgRounded = Math.round((stats.avgRating || 0) * 10) / 10; // 1 decimal

                const updateResult = await booksCollection.updateOne(
                    bookFilter,
                    {
                        $set: {
                            rating: newAvgRounded,
                            ratingCount: stats.count || 0,
                            rating_updated_at: new Date()
                        }
                    }
                );

                res.send({
                    ok: true,
                    insertedId: insertResult.insertedId,
                    rating: newAvgRounded,
                    ratingCount: stats.count || 0,
                    updateResult
                });

            } catch (err) {
                console.error("Error in POST /reviews:", err);
                res.status(500).send({ ok: false, message: "Server error", error: err.message });
            }
        });



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