import Token from '../models/Token.js';

/**
 * Creates a new token in the database.
 *
 * @description Creates a new token in the database. The token is
 * associated with the provided email address, and the pin is stored
 * in the document.
 * @function createToken
 * @param {number} pin - The pin to store in the token.
 * @param {string} email - The email address to associate with the token.
 * @returns {Promise<Object>} A promise that resolves to the created token
 * object.
 */
export const createToken = (pin, email) => {
  return Token.create({ pin, email });
};

/**
 * Finds a token in the database by email and pin.
 *
 * @description Finds a token in the database by email and pin.
 * @function findToken
 * @param {string} email - The email address associated with the token.
 * @returns {Promise<Object|null>} A promise that resolves to the found
 * token object, or null if no token is found.
 */
export const findTokenByEmail = (email) => {
  return Token.findOne({ email });
};

export const findTokenByPin = (pin) => {
  return Token.findOne({ pin });
};

/**
 * Updates a token in the database by pin.
 *
 * @description Updates a token in the database by pin.
 * @function updateToken
 * @param {number} pin - The pin associated with the token.
 * @returns {Promise<Object|null>} A promise that resolves to the updated
 * token object, or null if no token is found.
 */

export const updateToken = (email, pin) => {
  return Token.updateOne(
    { pin },
    { pin },
    {
      new: true,
      runValidators: true,
    }
  );
};

/**
 * Deletes a token from the database by pin.
 *
 * @description Deletes a token from the database by pin.
 * @function deleteToken
 * @param {number} pin - The pin associated with the token to delete.
 * @returns {Promise<Object|null>} A promise that resolves to the deleted
 * token object, or null if no token is found.
 */
export const deleteToken = (pin) => {
  return Token.findOneAndDelete({ pin });
};
