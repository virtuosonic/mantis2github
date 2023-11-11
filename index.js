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

function myDelay() {

	return new Promise(resolve => setTimeout(resolve, 1000));
}

function logAndReturnJson(name,res)
{
	if(res.status > 299)
	{
		console.log(name,res.status);
		return res.json().then(data => {
			console.log('json',data);
			return Promise.reject("failed");
		});
		
	}
	return res.json()
}

inquirer.prompt(questions)
	.then(answers => {
		fetchMantisData(answers)
			.then(data => filterByProject(data,answers.mantisProject))
			.then(data => extractUsers(data))
			.then(data => substituteUsers(data))
			.then(data => createGitHubIssues(data,answers))
			.catch( error => console.log(error))
	})
	.catch(error => console.error(error));

function getMantisFullUrl(url)
{
	return url + 
		((url.endsWith('/') ? 
			"api/rest/issues/" : "/api/rest/issues/"))
		+ "?page_size=1000000000&page=1";
}

function fetchMantisData(params)
{
	const mantisFullURL = getMantisFullUrl(params.mantisbtURL);
	const mantisInit = {
		method:"GET",
		mode: 'cors',
		cache: 'default',
		headers: {
			"Authorization": params.mantisApiToken,
	  	}
	};
  	return fetch(mantisFullURL,mantisInit)
		.then(response => logAndReturnJson('fetchMantisData',response));
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
	let text = "### Description\n" + issue.description;
	if(issue.hasOwnProperty('steps_to_reproduce'))
		text += "\n### Step to reproduce" + "\n" + issue.steps_to_reproduce;
	if(issue.hasOwnProperty('additional_information'))
		text += "\n### Additional information\n" + issue.additional_information;
	return text;
}
/*
10 open
20 fixed
30 reopened
40 unable to reproduce
50 not fixable
60 duplicate
70 no change required
80 suspended
90 won't fix
*/
async function createGithubIssueResolution(issue,githubIssueNumber,params)
{
	let status = issue.status.id;
	if(status == 80 || status == 90)
	{
		let resolution = issue.resolution.id;
		let resolutionInit = {...params.init};
		resolutionInit.method = "PATCH";
		resolutionInit.body = JSON.stringify({
			"state": "closed",
			"state_reason": resolution == 20 ? "completed" : "not_planned",
		});
		await myDelay();
		const updateIssueUrl = `https://api.github.com/repos/${params.repo}/issues/${githubIssueNumber}`;
		const res = fetch(updateIssueUrl,resolutionInit)
			.then(response => logAndReturnJson(response));
		return res;
	}
	return Promise.resolve(issue);
}

function createGithubIssue(issue,params) 
{
	let issueInit = {...params.init};
	issueInit.body = JSON.stringify({
		"title": issue.summary,
		"body": issueTextBody(issue),
	});
	if (issue.hasOwnProperty("handler") && 
		issue.handler.hasOwnProperty("substitute"))
	{
		issueInit.body["assignees"] = [issue.handler.substitute];
	}
	return fetch(`https://api.github.com/repos/${params.repo}/issues`,issueInit)
		.then(response => logAndReturnJson("createGithubIssue",response))
		.then(jsondata => createGitHubComments(issue,jsondata.number,params))
		.then(jsondata =>createGithubIssueResolution(issue,jsondata.number,params));
}

async function createGitHubIssues(data,params)
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
	for (const issue of data.issues)
	{
		try {
			let createissue = await createGithubIssue(issue,fetchParams)
			promises.push(createissue);
			await myDelay();
		}
		catch(error)
		{
			return Promise.reject(error);
		}
	};
	return Promise.all(promises);
} 


function createComment(note,githubIssueNumber,params)
{
	let noteInit = {...params.init};
	noteInit.body = JSON.stringify({body: note.text});
	const url = `https://api.github.com/repos/${params.repo}/issues/${githubIssueNumber}/comments`;
	return fetch(url,noteInit)
		.then(data => logAndReturnJson('createComment',data));
}

async function createGitHubComments(issue,githubIssueNumber,params) 
{
	let responses = [];
	if (!issue.hasOwnProperty('notes'))
	{
		return Promise.resolve({number:githubIssueNumber});
	}
	for (const note of issue.notes)
	{
		try 
		{
			let c = await createComment(note,githubIssueNumber,params)
			await myDelay();
			responses.push(c);
		}
		catch(error)
		{
			return Promise.reject(error);
		}
	}
	
	return Promise.all(responses)
		.then(values => Promise.resolve({number:githubIssueNumber,responses:values}));
}
