const mongoose = require('mongoose');

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 1000;
const EVENT_STATUSES = ['upcoming', 'completed', 'cancelled'];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: TITLE_MIN_LENGTH,
      maxlength: TITLE_MAX_LENGTH,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: DESCRIPTION_MAX_LENGTH,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
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
    category: {
      type: String,
      required: true,
      trim: true,
    },
    maxParticipants: {
      type: Number,
      required: true,
      min: 1,
      max: 500,
    },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator: function (value) {
          return this.maxParticipants === undefined || value.length <= this.maxParticipants;
        },
        message: 'Number of participants cannot exceed maxParticipants.',
      },
    },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: 'upcoming',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);