const jwt = require('jsonwebtoken')

module.exports = function (request, response, next){
	const token = request.session.token;
	if (!token){
		return response.status(401).send('Access denied');
	} else {
		try {
			const verified = jwt.verify(token, process.env.TOKEN_SECRET);
			request.user = verified;
			next();
		} catch (err) {
			response.status(400).send('Invalid token');
		}
	}
}