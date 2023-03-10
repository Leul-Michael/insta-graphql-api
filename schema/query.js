const jwt = require("jsonwebtoken")

const User = require("../models/User")
const Post = require("../models/Post")
const Comment = require("../models/Comment")

const { PostType, CommentType, UserType, SearchType } = require("./types")

const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLError,
  GraphQLID,
  GraphQLInt,
} = require("graphql")

const RootQuery = new GraphQLObjectType({
  name: "RootQueryType",
  fields: {
    getMe: {
      type: UserType,
      resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        return User.findById(req.user).select("-password")
      },
    },
    searchUsers: {
      type: SearchType,
      args: {
        query: { type: GraphQLNonNull(GraphQLString) },
        page: { type: GraphQLNonNull(GraphQLInt) },
      },
      async resolve(parent, args, { req }) {
        const limit = 10 // 10 pre page
        const results = {}

        const startIndex = (args.page - 1) * limit
        const endIndex = args.page * limit

        if (endIndex < (await User.countDocuments().exec())) {
          results.next = {
            page: args.page + 1,
            limit,
          }
        }

        if (startIndex > 0) {
          results.prev = {
            page: page - 1,
            limit,
          }
        }

        try {
          results.results = await User.find({
            name: { $regex: args.query, $options: "i" },
          })
            .limit(limit)
            .skip(startIndex)
            .exec()

          return results
        } catch (e) {
          console.log(e)
          throw new GraphQLError(e.message)
        }
      },
    },
    getUser: {
      type: UserType,
      args: {
        userId: { type: GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        try {
          const requestedUser = await User.findById(args.userId).select(
            "-password"
          )
          return requestedUser
        } catch {
          throw new GraphQLError("No User Found!")
        }
      },
    },
    userSuggestions: {
      type: new GraphQLList(UserType),
      async resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        try {
          const loggedUser = await User.findById(req.user).select("-password")

          const suggestions = await User.find().select("-password")
          const result = suggestions.filter((user) => {
            return (
              !loggedUser.following.includes(user.id) &&
              user.id !== loggedUser.id
            )
          })
          return result
        } catch (e) {
          throw new GraphQLError("No User Found!")
        }
      },
    },
    logout: {
      type: UserType,
      async resolve(_, args, { req, res }) {
        res.clearCookie("mfjwt", {
          httpOnly: true,
          sameSite: "None",
          secure: true,
        })

        return { token: null }
      },
    },
    posts: {
      type: new GraphQLList(PostType),
      resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        return Post.find().sort({ createdAt: -1 })
      },
    },
    userPosts: {
      type: new GraphQLList(PostType),
      args: {
        userId: { type: GraphQLNonNull(GraphQLID) },
      },
      resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        return Post.find({ user: args.userId }).sort({ createdAt: -1 })
      },
    },
    userPost: {
      type: PostType,
      args: {
        postId: { type: GraphQLNonNull(GraphQLID) },
      },
      resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        return Post.findById(args.postId)
      },
    },
    refresh: {
      type: UserType,

      async resolve(_, args, { req }) {
        const refreshToken = req.cookies.mfjwt

        if (!refreshToken) throw new GraphQLError("Login!")

        const decoded = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET
        )

        const foundUser = await User.findById(decoded.userId)
        if (!foundUser) throw new GraphQLError("Unauthorized")
        const accessToken = jwt.sign(
          {
            userId: foundUser.id,
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "7d" }
        )

        return {
          token: accessToken,
          id: foundUser.id,
          username: foundUser.username,
        }
      },
    },
  },
})

module.exports = RootQuery
