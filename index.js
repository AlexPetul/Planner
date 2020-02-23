const express = require("express");
const multer  = require('multer');
const crypto = require('crypto');
const mime = require('mime');
const dotenv = require('dotenv')
const mongoose = require('mongoose');
const User = require("./model/User");
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const verify = require('./middlewares/verifyToken')
const session = require('express-session')
const { registerValidation, loginValidation } = require('./validation')
const fs = require("fs");
const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();

const app = express();

// STORAGE CONFIG
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, 'uploads/')
	},
	filename: function (req, file, cb) {
		crypto.pseudoRandomBytes(16, function (err, raw) {
			cb(null, raw.toString('hex') + Date.now() + '.' + mime.getExtension(file.mimetype));
		});
	}
});
var upload = multer({ storage: storage });

app.set('views', 'templates');
app.set('view engine', 'hbs');

// DATABASE CONNECT
dotenv.config();
mongoose.connect(process.env.DB_CONNECT, { useNewUrlParser: true, useUnifiedTopology: true },
	() => console.log("connected to db!")
	);

// MIDDLEWARE
app.use(express.static('public'));

app.use(session({
	secret: 'keyboard cat',
	cookie: { maxAge: 60000000 },
	resave: true,
	saveUninitialized: true
}));


// ROUTES
app.get("/", function(request, response){
	response.render('index', {});
});

app.post("/api/register", jsonParser, async (request, response) => {
	const { error } = registerValidation(request.body);
	if (error) {
		return response.status(400).send(error.details[0].message);
	} else {
		const emailExists = await User.findOne({email: request.body.email});
		console.log(request.body.email);
		if (emailExists) {
			return response.status(400).send('Email already exists');
		} else {
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(request.body.password, salt);
			const user = new User({
				name: request.body.name,
				email: request.body.email,
				password: hashedPassword
			});
			try {
				const savedUser = await user.save();
				response.send(200).send("User created");
			} catch (err) {
				response.status(400).send(err);
			}
		}
	}
});

app.post('/api/login', jsonParser, function(request, response) {
	const { error } = loginValidation(request.body);
	if (error) {
		return response.status(400).send(error.details[0].message);
	} else {
		const user = User.findOne({email: request.body.email});
		if (!user) {
			return response.status(400).send('Email or password is wrong.');
		} else {
			const validPassword = bcrypt.compare(request.body.password, user.password);
			if (!validPassword){
				return response.status(400).send('Password is wrong');
			} else {
				const token = jwt.sign({_id: user._id}, process.env.TOKEN_SECRET);
				request.session.token = token;
				response.redirect('/');
			}
		}
	}
});

app.get("/api/plans", function(request, response){
	var content = fs.readFileSync("plans.json", "utf8");
	var plans = JSON.parse(content);
	response.send(plans);
});

app.get('/download', function(request, response){
	var file = `${__dirname}/${request.query.file_path}`;
	response.download(file);
});

app.post("/api/create-plan", verify, upload.single('attachment'), function(request, response){
	if (!request.body) {
		return response.sendStatus(400);
	}
	else {
		var planData = JSON.parse(request.body.data);
		var data = fs.readFileSync("plans.json", "utf8");
		var plans = JSON.parse(data);
		var id = 0;
		if (plans.length == 0) {
			id = 1;
		}
		else {
			var ids = [];
			for (var index = 0; index < plans.length; ++index) {
				ids.push(plans[index].id);
			}
			id = Math.max.apply(null, ids) + 1;
		}
		var title = planData.title;
		var content = planData.content;
		var deadline = planData.deadline;
		var status = 'Не прочитано';
		var newPlan = { id: id, status: status, title: title, content: content, deadline: deadline };
		if (typeof request.file !== 'undefined' && request.file){
			newPlan['attachment'] = request.file.path;
		}
		plans.push(newPlan);
		var newData = JSON.stringify(plans);
		fs.writeFileSync("plans.json", newData);
		response.send(newPlan);
	}
});

app.delete("/api/delete-plan", jsonParser, function(request, response){
	var plan_id = request.body.plan_id;
	var data = fs.readFileSync("plans.json", "utf8");
	var plans = JSON.parse(data);
	var isPlanFound = false;
	for (var index = 0; index < plans.length; ++index) {
		if (plans[index].id == plan_id) {
			plans.splice(index, 1);
			isPlanFound = true;
			break;
		}
	}
	if (!isPlanFound) {
		response.sendStatus(404);
	}
	else{
		fs.writeFileSync("plans.json", JSON.stringify(plans));
		response.send(plan_id);
	}
});

app.put("/api/change-plan-status", jsonParser, function(request, response){
	var planId = request.body.plan_id;
	var newStatus = request.body.new_status;
	var data = fs.readFileSync("plans.json", "utf8");
	var plans = JSON.parse(data);
	for (var index = 0; index < plans.length; ++index) {
		if (plans[index].id == planId) {
			plans[index].status = newStatus;
			break;
		}
	}
	fs.writeFileSync("plans.json", JSON.stringify(plans));
	response.send(new_status);
});

app.get("/api/get-plans-by-status", function(request, response){
	var sortQuery = request.query.sortQuery;
	var newPlanList = [];
	var data = fs.readFileSync("plans.json", "utf8");
	var plans = JSON.parse(data);
	if (sortQuery == 'Все') {
		response.send(plans);
	}
	else{
		for (var index = 0; index < plans.length; ++index) {
			if (plans[index].status == sortQuery) {
				newPlanList.push(plans[index]);
			}
		}
		response.send(`newPlanList`);
	}
});


app.listen(3000, () => 
	console.log(`Server started, port: ${3000}`)
	);