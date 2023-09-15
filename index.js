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
  
console.log("mantis2github",'0.0.1');

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
    	name: 'githubRepo',
		message: "Type the destination GitHub repo",
	},

];

inquirer.prompt(questions).then(answers => {
  console.log(answers);
});
