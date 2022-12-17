const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const { PostType, CommentType, UserType } = require("./types")
const User = require("../models/User")
const Post = require("../models/Post")
const Comment = require("../models/Comment")

const {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLError,
} = require("graphql")

const mutation = new GraphQLObjectType({
  name: "Mutations",
  fields: {
    register: {
      type: UserType,
      args: {
        name: { type: GraphQLNonNull(GraphQLString) },
        email: { type: GraphQLNonNull(GraphQLString) },
        username: { type: GraphQLNonNull(GraphQLString) },
        password: { type: GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
        if (args.password.length < 6) {
          throw new GraphQLError("Password must be greater than 6 characters.")
        }

        const userExists = await User.findOne({
          email: args.email.toLowerCase(),
        })

        if (userExists) {
          throw new GraphQLError("Email already exists")
        }

        const userNameExists = await User.findOne({
          username: args.username,
        })

        if (userNameExists) {
          throw new GraphQLError("Username already exists")
        }

        // Hash password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(args.password, salt)

        const user = new User({
          name: args.name,
          email: args.email.toLowerCase(),
          username: args.username,
          password: hashedPassword,
        })

        await user.save()

        return { username: user.username }
      },
    },
    login: {
      type: UserType,
      args: {
        email: { type: GraphQLNonNull(GraphQLString) },
        password: { type: GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args, { req, res }) {
        const user = await User.findOne({
          email: args.email.toLowerCase(),
        })

        if (!user) {
          throw new GraphQLError("Invalid Email!")
        }

        if (user && (await bcrypt.compare(args.password, user.password))) {
          const accessToken = jwt.sign(
            { userId: user.id },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "7d" }
          )
          const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: "7d" }
          )

          res.cookie("mfjwt", refreshToken, {
            httpOnly: true,
            sameSite: "None",
            secure: true,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
          })

          return { token: accessToken, id: user.id, username: user.username }
        } else {
          throw new GraphQLError("Invalid Password!")
        }
      },
    },
    updateProfile: {
      type: UserType,
      args: {
        name: { type: GraphQLNonNull(GraphQLString) },
        username: { type: GraphQLNonNull(GraphQLString) },
        email: { type: GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        try {
          const emailExists = await User.findOne({ email: args.email })

          // console.log("user", req.user)
          // console.log("em", emailExists.id)

          if (emailExists.id !== req.user) {
            throw new GraphQLError("Email already exists!")
          }

          const usernameExists = await User.find({
            username: args.username,
          })

          // console.log("un", usernameExists.id)

          if (usernameExists.id !== req.user) {
            throw new GraphQLError("Username already exists!")
          }

          const updatedUser = await User.findByIdAndUpdate(
            req.user,
            {
              $set: {
                name: args.name,
                username: args.username,
                email: args.email,
              },
            },
            { new: true }
          )

          return updatedUser
        } catch (e) {
          throw new GraphQLError(e.message)
        }
      },
    },
    changePassword: {
      type: UserType,
      args: {
        password: { type: GraphQLNonNull(GraphQLString) },
        newPwd: { type: GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        try {
          const loggedUser = await User.findById(req.user)

          if (!loggedUser) {
            throw new GraphQLError("User not found!")
          }

          const passwordMatch = await bcrypt.compare(
            args.password,
            loggedUser.password
          )

          if (!passwordMatch) {
            throw new GraphQLError("Incorrect old password!")
          }

          // Hash password
          const salt = await bcrypt.genSalt(10)
          const hashedPassword = await bcrypt.hash(args.newPwd, salt)

          loggedUser.password = hashedPassword

          const user = await loggedUser.save()

          return user
        } catch (e) {
          throw new GraphQLError(e.message)
        }
      },
    },
    addPost: {
      type: PostType,
      args: {
        caption: { type: GraphQLNonNull(GraphQLString) },
        picture: { type: GraphQLNonNull(GraphQLString) },
      },
      resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        const post = new Post({
          user: req.user,
          caption: args.caption,
          picture: args.picture,
        })

        return post.save()
      },
    },
    likePost: {
      type: PostType,
      args: {
        id: { type: GraphQLNonNull(GraphQLID) },
        user: { type: GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        const post = await Post.findById(args.id)
        if (post.likes.includes(args.user)) {
          const likeIndex = post.likes.indexOf(args.user)
          post.likes.splice(likeIndex, 1)
        } else {
          post.likes.unshift(args.user)
        }
        try {
          return await post.save()
        } catch (e) {
          throw new GraphQLError(e.message)
        }
      },
    },
    commentPost: {
      type: PostType,
      args: {
        post: { type: GraphQLNonNull(GraphQLID) },
        comment: { type: GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        const comment = new Comment({
          user: req.user,
          post: args.post,
          comment: args.comment,
        })

        const savedComment = await comment.save()

        const post = await Post.findById(args.post)
        post.comments.unshift(savedComment)

        return post.save()
      },
    },
    followUser: {
      type: UserType,
      args: {
        userId: { type: GraphQLNonNull(GraphQLID) },
      },
      async resolve(_, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        const user = await User.findById(args.userId)
        const currentUser = await User.findById(req.user)

        if (!user || !currentUser) {
          throw new GraphQLError("User not found!")
        }

        if (user.followers.includes(req.user)) {
          const followerIndex = user.followers.indexOf(req.user)
          const followingIndex = user.following.indexOf(user.id)
          user.followers.splice(followerIndex, 1)
          currentUser.following.splice(followingIndex, 1)
        } else {
          user.followers.unshift(req.user)
          currentUser.following.unshift(user.id)
        }

        try {
          await user.save()
          await currentUser.save()
          return currentUser
        } catch (e) {
          console.log(e.message)
          throw new GraphQLError("Something went wrong!")
        }
      },
    },
    removePost: {
      type: PostType,
      args: {
        id: { type: GraphQLNonNull(GraphQLID) },
      },
      async resolve(parent, args, { req }) {
        if (!req.user) throw new GraphQLError("Not Authorised!")
        let post
        try {
          post = await Post.findById(args.id)
          if (post.user.toString() !== req.user) {
            throw new GraphQLError("You're not allowed!")
          }

          await post.remove()
          return { id: post.id }
        } catch (e) {
          if (!post) {
            throw new GraphQLError("Post not found!")
          } else {
            throw new GraphQLError(e.message)
          }
        }
      },
    },
  },
})

module.exports = mutation
