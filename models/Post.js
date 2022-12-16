const mongoose = require("mongoose")
const Comment = require("./Comment")

const PostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    caption: {
      type: String,
    },
    excerpt: {
      type: String,
    },
    picture: {
      type: String,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  {
    timestamps: true,
  }
)

PostSchema.pre("remove", async function (next) {
  this.comments.map(async (comment) => {
    const postComment = await Comment.findById(comment.toString())
    await postComment.remove()
  })

  next()
})

module.exports = mongoose.model("Post", PostSchema)
