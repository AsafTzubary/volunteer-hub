const mongoose = require('mongoose');

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 60;

const DESCRIPTION_MAX_LENGTH = 500;

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: NAME_MIN_LENGTH,
      maxlength: NAME_MAX_LENGTH,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: DESCRIPTION_MAX_LENGTH,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    address: {
      type: String,
      trim: true,
      default: '',
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);