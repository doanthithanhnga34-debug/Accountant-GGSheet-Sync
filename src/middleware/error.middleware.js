

function errorHandler(error, req,res, next){
const statusCode = error.statusCode || error.status || 500;

return res.status(statusCode).json({
    success:false,
    message: error.message || "Internal Server Error"
})
}

module.exports = errorHandler