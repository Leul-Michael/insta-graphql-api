const User = require("../models/User")
const Comment = require("../models/Comment")

const {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLList,
  GraphQLInt,
} = require("graphql")

const UserType = new GraphQLObjectType({
  name: "User",
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    email: { type: GraphQLString },
    username: { type: GraphQLString },
    password: { type: GraphQLString },
    profile: { type: GraphQLString },
    followers: {
      type: new GraphQLList(UserType),
      resolve(parent, args) {
        return parent.followers.map((follower) => {
          return User.findById(follower)
        })
      },
    },
    following: {
      type: new GraphQLList(UserType),
      resolve(parent, args) {
        return parent.following.map((flg) => {
          return User.findById(flg)
        })
      },
    },
    token: { type: GraphQLString },
  }),
})

const CommentType = new GraphQLObjectType({
  name: "Comment",
  fields: () => ({
    id: { type: GraphQLID },
    comment: { type: GraphQLString },
    likes: {
      type: new GraphQLList(UserType),
      resolve(parent, args) {
        return parent.likes.map((like) => {
          return User.findById(like)
        })
      },
    },
    user: {
      type: UserType,
      resolve(parent, args) {
        return User.findById(parent.user)
      },
    },
  }),
})

const PostType = new GraphQLObjectType({
  name: "Post",
  fields: () => ({
    id: { type: GraphQLID },
    caption: { type: GraphQLString },
    excerpt: { type: GraphQLString },
    picture: { type: GraphQLString },
    createdAt: { type: GraphQLString },
    user: {
      type: UserType,
      resolve(parent, args) {
        return User.findById(parent.user)
      },
    },
    likes: {
      type: new GraphQLList(UserType),
      resolve(parent, args) {
        return parent.likes.map((like) => {
          return User.findById(like)
        })
      },
    },
    comments: {
      type: new GraphQLList(CommentType),
      resolve(parent, args) {
        return parent.comments.map((comment) => {
          return Comment.findById(comment)
        })
      },
    },
  }),
})

const PageType = new GraphQLObjectType({
  name: "Page",
  fields: () => ({
    page: { type: GraphQLInt },
    limit: { type: GraphQLInt },
  }),
})

const SearchType = new GraphQLObjectType({
  name: "Search",
  fields: () => ({
    next: { type: PageType },
    prev: { type: PageType },
    results: { type: new GraphQLList(UserType) },
  }),
})

module.exports = { UserType, CommentType, PostType, SearchType }
