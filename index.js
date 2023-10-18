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
const ghApiVersion = '2022-11-28';

const questions = [
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
    	name: 'githubRepo',
		message: "Type the destination GitHub repo (owner/repo)",
	},
	{	
		type: 'input',
    	name: 'githubToken',
		message: "Type your Personal Access Token",
	},

];

inquirer.prompt(questions)
	.then(answers => {
		fetchMantisData(answers)
			.then(data => filterByProject(data,answers.mantisProject))
			.then(data => extractUsers(data))
			.then(data => substituteUsers(data))
			//.then(data => console.log(JSON.stringify(data,null,2)))
			.then(data => createGitHubIssues(data,answers))
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

function issueTextBody(issue)
{
	let text = "## " + issue.description;
	if(issue.hasOwnProperty('steps_to_reproduce'))
		text += "\n### Step to reproduce" + "\n" + issue.steps_to_reproduce;
	if(issue.hasOwnProperty('additional_information'))
		text += "\n### Additional information\n" + issue.additional_information;
	return text;
}

function createIssue(issue,params) 
{
	let issueInit = {...params.init};
	issueInit.body = JSON.stringify({
		"title": issue.summary,
		"body": issueTextBody(issue),
	});
	//todo: labels
	if (issue.hasOwnProperty("handler") && 
		issue.handler.hasOwnProperty("substitute"))
	{
		issueInit.body["assignees"] = [issue.handler.substitute];
	}
	return fetch(`https://api.github.com/repos/${params.repo}/issues`,issueInit)
		.then(response => response.json())
		.then(jsondata => createGitHubComments(issue,jsondata.number,params));
	//todo: close issue if source issue is closed
}

function createGitHubIssues(data,params) 
{
	const fetchParams = {
		repo: params.githubRepo,
		init: {
			method:"POST",
			mode: 'cors',
			cache: 'default',
			headers: {
				"Authorization": `Bearer ${params.githubToken}`,
				"Accept": "application/vnd.github+json",
				"X-GitHub-Api-Version": ghApiVersion
	  		}
		}
	};
	let promises = [];
	data.issues.forEach((issue) => promises.push(createIssue(issue,fetchParams)) );
	return Promise.all(promises);
} 


function createComment(note,githubIssueNumber,params)
{
	let noteInit = {...params.init};
	noteInit.body = JSON.stringify({body: note.text});
	const url = `https://api.github.com/repos/${params.repo}/issues/${githubIssueNumber}/comments`;
	return fetch(url,noteInit)
		.then(data => data.json());
}

async function createGitHubComments(issue,githubIssueNumber,params) 
{
	let responses = [];
	if (!issue.hasOwnProperty('notes'))
	{
		return Promise.resolve([]);
	}
	for (const note of issue.notes)
	{
		responses.push(await createComment(note,githubIssueNumber,params));
	}
	return Promise.all(responses);
}
