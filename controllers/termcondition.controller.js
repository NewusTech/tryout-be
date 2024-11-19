const { response } = require('../helpers/response.formatter');

const { Term_condition } = require('../models');

const Validator = require("fastest-validator");
const v = new Validator();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    useAccelerateEndpoint: true
});

module.exports = {
    getTermCondition: async (req, res) => {
        try {
            //get data by id
            let termcondGet = await Term_condition.findOne();

            if (!termcondGet) {
                res.status(404).json(response(404, 'term condition not found'));
                return;
            }
            res.status(200).json(response(200, 'success get term condition', termcondGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    updateTermCondition: async (req, res) => {
        try {
            let termcondGet = await Term_condition.findOne()

            //cek apakah data termcond ada
            if (!termcondGet) {
                res.status(404).json(response(404, 'term condition not found'));
                return;
            }

            const schema = {
                term_condition: {
                    type: "string",
                    min: 3,
                    optional: true
                },
                privacy_policy: {
                    type: "string",
                    min: 3,
                    optional: true
                },
            }

              let descUpdateObj = {
                term_condition: req.body.term_condition,
                privacy_policy: req.body.privacy_policy
            };

            const validate = v.validate(descUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            // Update desc
            await Term_condition.update(descUpdateObj, {
                where: { id: termcondGet.id },
            });
            let descAfterUpdate = await Term_condition.findOne();

            res.status(200).json(response(200, 'success update term condition', descAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

}