const express = require("express");
const multer  = require('multer');
const crypto = require('crypto');
const mime = require('mime');
const dotenv = require('dotenv')
const mongoose = require('mongoose');
const User = require("./model/User");
const { registerValidation } = require('./validation')

const app = express();

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

const fs = require("fs");
const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();

dotenv.config();
mongoose.connect(process.env.DB_CONNECT, { useNewUrlParser: true, useUnifiedTopology: true },
	() => console.log("connected to db!")
);

app.use(express.static('public'));

app.get("/", function(request, response){
	response.render('index', {});
});

app.get("/register", function(request, response){
	response.send("<h1>da</h1>");
});

app.post("/register", jsonParser, async (request, response) => {
	const { error } = registerValidation(request.body);
	if (error) {
		return response.status(400).send(error.details[0].message);
	} else {
		const user = new User({
			name: request.body.name,
			email: request.body.email,
			password: request.body.password
		});
		try {
			const savedUser = await user.save();
			response.send(savedUser);
		} catch (err) {
			response.status(400).send(err);
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

app.post("/api/create-plan", upload.single('attachment'), function(request, response){
	if (!request.body) {
		return response.sendStatus(400);
	}
	else {
		var plan_data = JSON.parse(request.body.data);
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
		var title = plan_data.title;
		var content = plan_data.content;
		var deadline = plan_data.deadline;
		var status = 'Не прочитано';
		var new_plan = { id: id, status: status, title: title, content: content, deadline: deadline };
		if (typeof request.file !== 'undefined' && request.file){
			var attachment_path = request.file.path;
			new_plan['attachment'] = attachment_path;
		}
		plans.push(new_plan);
		var new_data = JSON.stringify(plans);
		fs.writeFileSync("plans.json", new_data);
		response.send(new_plan);
	}
});

app.delete("/api/delete-plan", jsonParser, function(request, response){
	var plan_id = request.body.plan_id;
	var data = fs.readFileSync("plans.json", "utf8");
	var plans = JSON.parse(data);
	var is_plan_found = false;
	for (var index = 0; index < plans.length; ++index) {
		if (plans[index].id == plan_id) {
			plans.splice(index, 1);
			is_plan_found = true;
			break;
		}
	}
	if (!is_plan_found) {
		response.sendStatus(404);
	}
	else{
		fs.writeFileSync("plans.json", JSON.stringify(plans));
		response.send(plan_id);
	}
});

app.put("/api/change-plan-status", jsonParser, function(request, response){
	var plan_id = request.body.plan_id;
	var new_status = request.body.new_status;
	var data = fs.readFileSync("plans.json", "utf8");
	var plans = JSON.parse(data);
	for (var index = 0; index < plans.length; ++index) {
		if (plans[index].id == plan_id) {
			plans[index].status = new_status;
			break;
		}
	}
	fs.writeFileSync("plans.json", JSON.stringify(plans));
	response.send(new_status);
});

app.get("/api/get-plans-by-status", function(request, response){
	var sort_query = request.query.sort_query;
	var new_plan_list = [];
	var data = fs.readFileSync("plans.json", "utf8");
	var plans = JSON.parse(data);
	if (sort_query == 'Все') {
		response.send(plans);
	}
	else{
		for (var index = 0; index < plans.length; ++index) {
			if (plans[index].status == sort_query) {
				new_plan_list.push(plans[index]);
			}
		}
		response.send(new_plan_list);
	}
});


app.listen(3000, () => 
	console.log(`Server started, port: ${3000}`)
	);