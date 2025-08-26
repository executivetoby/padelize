import { Model } from 'mongoose';
import APIFeatures from '../utils/apiFeatures.js';

/**
 * Creates a new document in the database.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {Object} data - The data to be created.
 * @returns {Promise<Object>} A promise that resolves with the created document object.
 */
export const createOne = async (Model, data) => {
  return Model.create(data);
};

/**
 * Inserts multiple documents into the database.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {Array} data - An array of objects containing the data for creating the new documents.
 * @returns {Promise<Array>} A promise that resolves to an array of created document objects.
 */
export const createMany = async (Model, data) => {
  return Model.insertMany(data);
};

/**
 * Retrieves multiple documents from the database.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {Object} [filter] - The filter to apply to the find query.
 * @returns {Promise<Array>} A promise that resolves with the array of fetched documents.
 */
export const findMany = async (Model, filter) => {
  if (filter) return Model.find(filter);
  return Model.find();
};

/**
 * Retrieves a single document from the database.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {Object} query - The query to search for the document.
 * @returns {Promise<Object|null>} A promise that resolves with the fetched document object if found, and null if not.
 */
export const findOne = async (Model, query, populate) => {
  console.log({ populate });
  return populate
    ? Model.findOne(query).populate(populate)
    : Model.findOne(query);
};

/**
 * Retrieves a single document from the database by its ID.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {string} id - The ID of the document to retrieve.
 * @returns {Promise<Object|null>} A promise that resolves with the fetched document object if found, and null if not.
 */
export const getOneById = async (Model, id) => {
  return Model.findById(id);
};

/** Updates a single document in the database.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {Object} query - The query to search for the document.
 * @param {Object} data - The data to update the document with.
 * @returns {Promise<Object|null>} A promise that resolves with the updated document object if found and updated, and null if not.
 */
export const updateOne = async (Model, query, data) => {
  return Model.findOneAndUpdate(query, data, {
    new: true,
    runValidators: true,
  });
};

/**
 * Deletes a single document from the database.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {Object} query - The query to search for the document.
 * @returns {Promise<Object|null>} A promise that resolves with the deleted document object if found and deleted, and null if not.
 */
export const deleteOne = async (Model, query) => {
  return Model.findOneAndDelete(query);
};

/**
 * Deletes multiple documents from the database that match the given filter.
 *
 * @param {Model} Model - The Model to operate with.
 * @param {Object} filter - The filter to apply to the deletion query.
 * @returns {Promise<Object>} A promise that resolves with an object containing the count of deleted documents.
 */
export const deleteMany = async (Model, filter) => {
  return Model.deleteMany(filter);
};

export const getAll = async (
  Model,
  filter = {},
  searchOptions = {},
  populateOptions
) => {
  // Handle search configuration
  const { searchFields = [], searchTerm = '' } = searchOptions;

  console.log({ searchFields, searchTerm, populateOptions });

  // If search term and fields are provided, add search conditions to filter
  if (searchTerm && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => ({
      [field]: { $regex: searchTerm, $options: 'i' },
    }));

    // Combine search conditions with existing filter using $and to maintain both
    filter = {
      $and: [filter, { $or: searchConditions }],
    };
  }

  console.log({ ...filter });
  // Create API features instance with the enhanced filter
  const features = new APIFeatures(Model.find(), filter)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Handle population if options are provided
  if (populateOptions) {
    features.query.populate(populateOptions);
  }

  // Execute the query
  const doc = await features.query;

  // Get the filter conditions for count
  const filterConditions = features.query.getFilter();

  // Get total count of matching documents
  const count = await Model.countDocuments(filterConditions);

  // Calculate total pages
  const totalPages = Math.ceil(count / features.query.options.limit);

  return {
    results: doc.length,
    totalPages,
    count,
    data: doc,
  };
};

// export const getAll = async (Model, filter, populateOptions) => {
//   // return catchAsync(async (req, res) => {
//   // let filter = {};
//   // if (req.user?.role === 'user') filter = { user: req.user._id };

//   // console.log({ filter }, req.query);

//   // let userFilter = {};
//   // if (user) userFilter.userId = user;

//   // console.log({ userFilter });

//   const features = new APIFeatures(Model.find(), filter)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();

//   let populateQuery = features.query;
//   if (populateOptions) features.query.populate(populateOptions);

//   const doc = await features.query;

//   const filterConditions = features.query.getFilter();

//   const count = await Model.countDocuments(filterConditions);
//   // const count = doc.length;

//   console.log({ count });

//   const totalPages = Math.ceil(count / features.query.options.limit);
//   console.log({ totalPages });

//   return {
//     results: doc.length,
//     totalPages,
//     data: doc,
//   };
//   // res.status(200).json({
//   //   status: 'success',
//   //   results: doc.length,
//   //   totalPages,
//   //   data: {
//   //     data: doc,
//   //   },
//   // });
//   // });
// };
