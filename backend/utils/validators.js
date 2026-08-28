const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[A-Za-z0-9]+$/;

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 64;

const GROUP_NAME_MIN_LENGTH = 3;
const GROUP_NAME_MAX_LENGTH = 60;
const GROUP_DESCRIPTION_MAX_LENGTH = 500;
const CATEGORY_MAX_LENGTH = 40;
const ADDRESS_MAX_LENGTH = 120;

const POST_CONTENT_MAX_LENGTH = 2000;

const EVENT_TITLE_MIN_LENGTH = 3;
const EVENT_TITLE_MAX_LENGTH = 100;
const EVENT_DESCRIPTION_MAX_LENGTH = 1000;
const EVENT_MAX_PARTICIPANTS_MIN = 1;
const EVENT_MAX_PARTICIPANTS_MAX = 500;

const RSVP_STATUSES = ['going', 'interested', 'not_going'];

function validateUsername(username) {
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username can only contain English letters and numbers.';
  }
  return null;
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateGroupName(name) {
  if (name.length < GROUP_NAME_MIN_LENGTH || name.length > GROUP_NAME_MAX_LENGTH) {
    return `Group name must be between ${GROUP_NAME_MIN_LENGTH} and ${GROUP_NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateCategory(category) {
  if (!category || typeof category !== 'string' || category.trim().length === 0 || category.length > CATEGORY_MAX_LENGTH) {
    return `Category is required and must be at most ${CATEGORY_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateGroupDescription(description) {
  if (description.length > GROUP_DESCRIPTION_MAX_LENGTH) {
    return `Description must be at most ${GROUP_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateAddress(address) {
  if (address.length > ADDRESS_MAX_LENGTH) {
    return `Address must be at most ${ADDRESS_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateCoordinate(value, min, max, label) {
  const number = Number(value);
  if (Number.isNaN(number) || number < min || number > max) {
    return `${label} must be a number between ${min} and ${max}.`;
  }
  return null;
}

function validateLatitude(value) {
  return validateCoordinate(value, -90, 90, 'Latitude');
}

function validateLongitude(value) {
  return validateCoordinate(value, -180, 180, 'Longitude');
}

function validatePostContent(content) {
  if (!content || content.trim().length === 0) {
    return 'Post content is required.';
  }
  if (content.trim().length > POST_CONTENT_MAX_LENGTH) {
    return `Post content must be at most ${POST_CONTENT_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateEventTitle(title) {
  if (!title || title.trim().length < EVENT_TITLE_MIN_LENGTH || title.length > EVENT_TITLE_MAX_LENGTH) {
    return `Event title must be between ${EVENT_TITLE_MIN_LENGTH} and ${EVENT_TITLE_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateEventDescription(description) {
  if (description.length > EVENT_DESCRIPTION_MAX_LENGTH) {
    return `Description must be at most ${EVENT_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  return null;
}

function validateEventDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 'A valid event date is required.';
  }
  if (parsed <= new Date()) {
    return 'Event date must be in the future.';
  }
  return null;
}

function validateMaxParticipants(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < EVENT_MAX_PARTICIPANTS_MIN || number > EVENT_MAX_PARTICIPANTS_MAX) {
    return `Max participants must be a whole number between ${EVENT_MAX_PARTICIPANTS_MIN} and ${EVENT_MAX_PARTICIPANTS_MAX}.`;
  }
  return null;
}

function validateRsvpStatus(status) {
  if (!RSVP_STATUSES.includes(status)) {
    return 'Invalid RSVP status.';
  }
  return null;
}

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  GROUP_NAME_MIN_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  GROUP_DESCRIPTION_MAX_LENGTH,
  CATEGORY_MAX_LENGTH,
  ADDRESS_MAX_LENGTH,
  EVENT_TITLE_MIN_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_MAX_PARTICIPANTS_MIN,
  EVENT_MAX_PARTICIPANTS_MAX,
  RSVP_STATUSES,
  validateUsername,
  validatePassword,
  validateGroupName,
  validateCategory,
  validateGroupDescription,
  validateAddress,
  validateLatitude,
  validateLongitude,
  validatePostContent,
  validateEventTitle,
  validateEventDescription,
  validateEventDate,
  validateMaxParticipants,
  validateRsvpStatus,
};