require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { graphqlHTTP } = require("express-graphql")
const mongoose = require("mongoose")
const cookieParser = require("cookie-parser")
const jwt = require("jsonwebtoken")

const schema = require("./schema/schema")

const app = express()

// Connectt to DB
mongoose.connect(process.env.MONGO_URL).then(
  () => {
    console.log("Connected to DB...")
  },
  (err) => {
    console.log(err)
  }
)

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    optionsSuccessStatus: 200,
  })
)

app.use(cookieParser())

function getUserId(req, res, next) {
  const authHeader = req?.headers.authorization || req?.headers.Authorization

  if (!authHeader?.startsWith("Bearer ")) {
    req.user = null
    return next()
  }

  try {
    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    req.user = decoded.userId
  } catch (e) {
    req.user = null
    console.log(e.message)
  }
  next()
}

app.use(getUserId)

app.use(
  "/graphql",
  graphqlHTTP((req, res, _) => ({
    schema,
    graphiql: process.env.NODE_ENV === "developement",
    context: { req, res },
  }))
)

app.listen(process.env.PORT, () =>
  console.log(`Server started listening on port ${process.env.PORT}...`)
)
