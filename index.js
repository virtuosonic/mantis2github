/**
 * mantis2github
 * Name:	index.js
 * Author:	Gabriel Espinoza <virtuosonic@github.com>
 * Date:	13-Sep-2023
 */

/*
apis
https://docs.github.com/en/rest/issues?apiVersion=2022-11-28
https://www.mantisbt.org/docs/master/en-US/Developers_Guide/html/restapi.html
*/

const inquirer = require('inquirer');

let questions = [
	{
		type: 'input',
    	name: 'mantisbtURL',
		message: "Type the URL of the Mantis BT"
	},
	{
		
		type: 'input',
    	name: 'mantisApiToken',
		message: "Type your Mantis Api Token",
	},
	{	
		type: 'input',
    	name: 'mantisProject',
		message: "Type Mantis project name or leave empty for all",
	},
	{	
		type: 'input',
    	name: 'githubOwner',
		message: "Type the owner of the GitHub repo",
	},
	{	
		type: 'input',
    	name: 'githubRepo',
		message: "Type the destination GitHub repo",
	},

];

inquirer.prompt(questions)
	.then(answers => {
		fetchMantisData(answers)
			.then(data => filterByProject(data,answers.mantisProject))
			.then(data => extractUsers(data))
			.then(data => substituteUsers(data))
			.then(data => console.log(JSON.stringify(data,null,2)))
			//.then(data => createGitHubIssues(data))
			.catch( error => console.log(error))
	})
	.catch(error => console.error(error));


function fetchMantisData(params)
{
	const mantisFullURL= params.mantisbtURL + (params.mantisbtURL.endsWith('/') ? "api/rest/issues/" : "/api/rest/issues/");
	const mantisInit = {
		method:"GET",
		mode: 'cors',
		cache: 'default',
		headers: {
			"Authorization": params.mantisApiToken,
	  	}
	};
  	return fetch(mantisFullURL,mantisInit)
		.then((response) => response.json());
}

function filterByProject(data,projectName)
{
	return new Promise((resolve,reject) => 
	{
		if (projectName.length == 0)
			resolve(data);
		let result = [];
		data.issues.forEach((issue) => {
			if (issue.project.name == projectName)
			{
				result.push(issue);
			}
		});
		resolve({"issues":result});
	});
}

function extractUsers(data)
{	
	return new Promise((resolve,reject) => {
		let result = {};
		data.issues.forEach( (i) => {
			result[i.reporter.id] = i.reporter; 
			if (i.hasOwnProperty('handler'))
				result[i.handler.id] = i.handler;
			if (i.hasOwnProperty('notes'))
				i.notes.forEach((n) => { result[n.reporter.id] = n.reporter; });
		});
		data.users = Object.values(result);
		resolve(data);
	});
}

function substituteUsers(data)
{
	return new Promise((resolve,reject) => {
		console.log("Type the GitHub user that replace the Mantis user");
		let _questions = [];
		data.users.forEach((u) => _questions.push({type:'input',name:u.id,message:u.name + ':' + u.real_name + ':' + u.email}));
		inquirer.prompt(_questions)
			.then(_answers => {
				data.users.forEach((u) => u.substitute = _answers[u.id] );
				resolve(data);
			})
			.catch(error => console.error(error));
		
	});
}


function createIssue() {
	return new Promise((resolve,reject) => {
		resolve(0);
	});
}

function createGitHubIssues(data) 
{
	let promises = [];
	console.log(JSON.stringify(data[0],null,2));
	data.forEach((issue) => {
		let p = createIssue(issue);
		promises.push(p);
	});
	return Promise.all(promises);
} 


function createNotes() {
	return new Promise((resolve,reject) => {
		resolve(0);
	});
}