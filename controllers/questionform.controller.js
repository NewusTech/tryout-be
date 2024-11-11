const { response } = require('../helpers/response.formatter');

const { Package_tryout, Question_form, sequelize } = require('../models');
require('dotenv').config()

const { Op } = require('sequelize');
const Validator = require("fastest-validator");
const v = new Validator();

module.exports = {

    // QUESTION BANK

    //membuat question form
    createQuestionForm: async (req, res) => {
        try {

            //membuat schema untuk validasi
            const schema = {
                field: {
                    type: "string",
                    min: 1,
                },
                tipedata: {
                    type: "string",
                    min: 1,
                    optional: true
                },
                status: {
                    type: "boolean",
                    optional: true
                },
                package_tryout_id: {
                    type: "number",
                    optional: true
                },
                type_question_id: {
                    type: "number",
                    optional: true
                },
                datajson: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "number" },
                            key: { type: "string" }
                        },
                        required: ["id", "key"]
                    },
                    optional: true
                },
                correct_answer: {
                    type: "string",
                    min: 1,
                },
                discussion: {
                    type: "string",
                    min: 1,
                },
            }

            //buat object question form
            let questionformCreateObj = {
                field: req.body.field,
                tipedata: req.body.tipedata,
                status: req.body.status !== undefined ? Boolean(req.body.status) : true, 
                package_tryout_id: req.body.package_tryout_id !== undefined ? Number(req.body.package_tryout_id) : null,
                type_question_id: req.body.type_question_id !== undefined ? Number(req.body.type_question_id) : null,
                datajson: req.body.datajson || null,
                correct_answer: req.body.correct_answer,
                discussion: req.body.discussion
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(questionformCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //buat question form
            let questionformCreate = await Question_form.create(questionformCreateObj);

            //response menggunakan helper response.formatter
            res.status(201).json(response(201, 'success create question form', questionformCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    createMultiQuestionForm: async (req, res) => {
        const transaction = await sequelize.transaction();

        try {
            // Define schema for validation
            const schema = {
                field: { type: "string", min: 1 },
                tipedata: { type: "string", min: 1 },
                status: { type: "boolean", optional: true },
                packagetryout_id: { type: "number", optional: true },
                typequestion_id: { type: "number", optional: true },
                correct_answer: { type: "number", min: 1 },
                discussion: { type: "string", min: 1 },
                datajson: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "number" },
                            key: { type: "string" }
                        },
                        required: ["id", "key"]
                    },
                    optional: true
                }
            };

            // Check if the request body is an array
            if (!Array.isArray(req.body)) {
                res.status(400).json(response(400, 'Request body must be an array of objects'));
                return;
            }

            // Initialize arrays for validation errors and successfully created objects
            let errors = [];
            let createdForms = [];

            // Validate and process each object in the input array
            for (let input of req.body) {
                // Create the question form object
                let questionformCreateObj = {
                    field: input.field,
                    tipedata: input.tipedata,
                    status: input.status !== undefined ? Boolean(input.status) : true,
                    packagetryout_id: input.packagetryout_id !== undefined ? Number(input.packagetryout_id) : null,
                    typequestion_id: input.typequestion_id !== undefined ? Number(input.typequestion_id) : null,
                    datajson: input.datajson || null,
                    correct_answer: input.correct_answer,
                    discussion: input.discussion
                };

                // Validate the object
                const validate = v.validate(questionformCreateObj, schema);
                if (validate.length > 0) {
                    errors.push({ input, errors: validate });
                    continue;
                }

                // Create question form in the database
                let questionformCreate = await Question_form.create(questionformCreateObj, { transaction });
                createdForms.push(questionformCreate);
            }

            // If there are validation errors, respond with them
            if (errors.length > 0) {
                res.status(400).json(response(400, 'Validation failed', errors));
                return;
            }

            // Respond with the successfully created objects
            await transaction.commit();
            res.status(201).json(response(201, 'Successfully created question form(s)', createdForms));
        } catch (err) {
            await transaction.rollback();
            res.status(500).json(response(500, 'Internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan semua form berdasarkan paket tryout
    getFormByPackage: async (req, res) => {
        try {
            const { packagetryout_id } = req.params;
    
            let formWhereCondition = {
                tipedata: {
                    [Op.ne]: "file"
                },
                status: true
            };
    
            if (req.user.role === 'User') {
                formWhereCondition.status = true;
            }
    
            let questionData = await Package_tryout.findOne({
                where: {
                    id: packagetryout_id,
                    deletedAt: null
                },
                attributes: ['name', 'slug', 'description'],
                include: [{
                    model: Question_form,
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                    where: formWhereCondition,
                    required: false,
                }],
                order: [[{ model: Question_form }, 'id', 'ASC']]
            });
    
            if (!questionData) {
                return res.status(404).json(response(404, 'Package tryout not found'));
            }
    
            res.status(200).json(response(200, 'Success get question with forms', questionData));
        } catch (err) {
            res.status(500).json(response(500, 'Internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan semua data question form
    getQuestionForm: async (req, res) => {
        try {
            //mendapatkan data semua question form
            let questionformGets = await Question_form.findAll({
                where: {
                    status: true
                }});
            

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get question form', questionformGets));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data questionform berdasarkan id
    getQuestionFormById: async (req, res) => {
        try {
            //mendapatkan data question form berdasarkan id
            let questionformGet = await Question_form.findOne({
                where: {
                    id: req.params.id,
                    status: true
                },
            });

            if (req.user.role !== 'Super Admin') {
                return res.status(403).send("Unauthorized: Insufficient role");
            }
            

            //cek jika question form tidak ada
            if (!questionformGet) {
                res.status(404).json(response(404, 'question form not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get question form by id', questionformGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate questionform berdasarkan id
    updateQuestionForm: async (req, res) => {
        const transaction = await sequelize.transaction();
        try {
            // Mendapatkan data questionform untuk pengecekan
            let questionformGet = await Question_form.findOne({
                where: {
                    id: req.params.id
                }
            });
    
            // Cek apakah data questionform ada
            if (!questionformGet) {
                await transaction.rollback();
                return res.status(404).json(response(404, 'questionform not found'));
            }
    
            await Question_form.update({ status: 0 }, {
                where: {
                    id: req.params.id
                },
                transaction
            });
    
            // Membuat schema untuk validasi
            const schema = {
                field: {
                    type: "string",
                    min: 1,
                    optional: true
                },
                tipedata: {
                    type: "string",
                    min: 1,
                    optional: true
                },
                status: {
                    type: "boolean",
                    optional: true
                },
                correct_answer: {
                    type: "string",
                    min: 1,
                    optional: true
                },
                discussion: {
                    type: "string",
                    min: 1,
                    optional: true
                },
                package_tryout_id: {
                    type: "number",
                    optional: true
                },
                type_question_id: {
                    type: "number",
                    optional: true
                },
                datajson: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "number" },
                            key: { type: "string" }
                        },
                        required: ["id", "key"]
                    },
                    optional: true
                }
            };
    
            // Buat object questionform baru
            let questionformCreateObj = {
                field: req.body.field,
                tipedata: req.body.tipedata,
                status: true,
                package_tryout_id: req.body.package_tryout_id !== undefined ? Number(req.body.package_tryout_id) : questionformGet.package_tryout_id,
                type_question_id: req.body.type_question_id !== undefined ? Number(req.body.type_question_id) : questionformGet.package_tryout_id,
                datajson: req.body.datajson || null,
                correct_answer: req.body.correct_answer,
                discussion: req.body.discussion,
            };
   
            const validate = v.validate(questionformCreateObj, schema);
            if (validate.length > 0) {
                await transaction.rollback();
                return res.status(400).json(response(400, 'validation failed', validate));
            }
    
            // Membuat form baru di database
            let questionformCreate = await Question_form.create(questionformCreateObj, { transaction });
    
            await transaction.commit();
    
            // Mendapatkan data questionform baru yang dibuat
            let questionformAfterCreate = await Question_form.findOne({
                where: {
                    id: questionformCreate.id,
                }
            });

            return res.status(200).json(response(200, 'success update and create new questionform', questionformAfterCreate));
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json(response(500, 'internal server error', err));
        }
    },

    //mengupdate question form
    updateMultiQuestionForm: async (req, res) => {
        const transaction = await sequelize.transaction();
        try {
            const schema = {
                id: { type: "number", min: 1, optional: true },
                field: { type: "string", min: 1 },
                tipedata: { type: "string", min: 1, optional: true },
                correct_answer: { type: "string", min: 1 },
                discussion: { type: "string", min: 1, optional: true },
                status: { type: "boolean", optional: true },
                datajson: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "number" },
                            key: { type: "string" }
                        },
                        required: ["id", "key"]
                    },
                    optional: true
                }
            };
            
            // Ambil layanan_id dari URL parameter
            // const layanan_id = req.params.layananid;
            // if (!layanan_id) {
            //     return res.status(400).json(response(400, 'layanan_id URL param is required'));
            // }
    
            // Check if the request body is an array
            if (!Array.isArray(req.body)) {
                return res.status(400).json(response(400, 'Request body must be an array of objects'));
            }
    
            // Initialize arrays for validation errors and successfully updated objects
            let errors = [];
            let updatedForms = [];
            let createdForms = [];
    
            // Validate and process each object in the input array
            for (let input of req.body) {
                // Check if the questionform exists
                let questionformGet = await Question_form.findOne({
                    where: {
                        id: input.id
                    }
                });
    
                if (!questionformGet) {
                    errors.push({ input, errors: ['question form not found'] });
                    continue;
                }
    
                // Update the status of the existing form to 0
                await Question_form.update(
                    { status: 0 }, // Update status to 0
                    { where: { id: input.id }, transaction }
                );
    
                // Create the new question form object for insertion
                let questionformCreateObj = {
                    field: input.field,
                    tipedata: input.tipedata,
                    correct_answer: input.correct_answer,
                    discussion: input.discussion,
                    status: input.status !== undefined ? Boolean(input.status) : true,
                    package_tryout_id: req.body.package_tryout_id !== undefined ? Number(req.body.package_tryout_id) : questionformGet.package_tryout_id,
                    type_question_id: req.body.type_question_id !== undefined ? Number(req.body.type_question_id) : questionformGet.type_question_id,
                    datajson: input.datajson || null
                };
    
                // Validate the new object
                const validate = v.validate(questionformCreateObj, schema);
                if (validate.length > 0) {
                    errors.push({ input, errors: validate });
                    continue;
                }
    
                // Create new question form in the database
                let questionformCreate = await Question_form.create(questionformCreateObj, { transaction });
                createdForms.push(questionformCreate);
            }
    
            // If there are validation errors, respond with them
            if (errors.length > 0) {
                await transaction.rollback();
                return res.status(400).json(response(400, 'Validation failed', errors));
            }
    
            // Commit transaction if everything is fine
            await transaction.commit();
            return res.status(200).json(response(200, 'Successfully updated and created new question form(s)', { createdForms }));
        } catch (err) {
            await transaction.rollback();
            console.log(err);
            return res.status(500).json(response(500, 'Internal server error', err));
        }
    },

    //menghapus question form berdasarkan id
    deleteQuestionForm: async (req, res) => {
        try {
            let questionformGet = await Question_form.findOne({
                where: {
                    id: req.params.id
                }
            });
    
            // Cek apakah data question form ada
            if (!questionformGet) {
                res.status(404).json(response(404, 'question form not found'));
                return;
            }
    
            await Question_form.update(
                { status: false },
                {
                    where: { id: req.params.id }
                }
            );
    
            // Response sukses
            res.status(200).json(response(200, 'Success delete question form')); 
        } catch (err) {
            if (err.name === 'SequelizeForeignKeyConstraintError') {
                res.status(400).json(response(400, 'Data tidak bisa diubah karena masih digunakan pada tabel lain'));
            } else {
                res.status(500).json(response(500, 'Internal server error', err));
                console.log(err);
            }
        }
    },
}