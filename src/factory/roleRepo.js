import Role from '../models/Role.js';

/**
 * Creates a new role in the database.
 *
 * @description Creates a new role in the database.
 * @function createRole
 * @param {Object} data - The data for creating the new role.
 * @returns {Promise<Object>} A promise that resolves to the created role object.
 */
export const createRole = async (data) => {
  return Role.create(data);
};

/**
 * Inserts multiple roles into the database.
 *
 * @description Inserts multiple roles into the database.
 * @function createManyRoles
 * @param {Array} data - An array of objects containing the data for creating the new roles.
 * @returns {Promise<Array>} A promise that resolves to an array of created role objects.
 */
export const createManyRoles = async (data) => {
  return Role.insertMany(data);
};

/**
 * Finds a role by ID in the database.
 *
 * @description Finds a role by ID in the database.
 * @function findRoleById
 * @param {string} id - The ID of the role to find.
 * @returns {Promise<Object>} A promise that resolves to the found role object.
 */
export const findRoleById = async (id) => {
  return Role.findById(id);
};

/**
 * Gets all roles from the database.
 *
 * @description Gets all roles from the database.
 * @function getAllRoles
 * @returns {Promise<Object>} A promise that resolves to an array of role objects.
 **/
export const getAllRoles = async () => {
  return Role.find();
};
