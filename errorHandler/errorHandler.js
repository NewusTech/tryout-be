function errorHandler(error, req, res, next) {
    console.log(error);
    console.log(error.name);
  
    // declare variable for status and message
    let status = 500;
    let message = "Internal Server Error";
  
    switch (error.name) {
      case "SequelizeValidationError":
      case "SequelizeUniqueConstraintError":
      case "SequelizeDatabaseError":
        status = 400;
        message = error.errors.map((err) => err.message);
        break;
      case "InvalidSlug":
        status = 404;
        message = "Data not found";
        break;
      case "InvalidId":
        status = 404;
        message = "Data not found";
        break;
    }
  
    res.status(status).json({ message });
  }
  
  module.exports = errorHandler;
  