const fileUpload = require('express-fileupload');

exports.Uploader = async function (api) {
    api.use(fileUpload({ createParentPath: true }));
};