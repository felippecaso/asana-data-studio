/** Function that returns the authentication type. */
function getAuthType() {
  var response = { type: 'OAUTH2' };
  return response;
};

/** Function that returns config data. */
function getConfig(request) {
  var config = {
    configParams: [
        {
            type: 'INFO',
            name: 'instructions',
            text: 'Input the desired project`s ID.'
        },
        {
            type: 'TEXTINPUT',
            name: 'projectId',
            displayName: 'Project ID',
            helpText: 'It can be found at https://app.asana.com/0/<PROJECT ID>',
            placeholder: '#'
        }
    ]
  };
  return config;
};

/* Creating schema for Asana Tasks. */
var asanaSchema = [
  {
    name: 'name',
    label: 'Task Name',
    description: 'The name of the task.',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION'
    }
  },
  {
    name: 'assignee',
    label: 'Assignee Name',
    description: 'The name of task assignee.',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION'
    }
  },
  {
    name: 'due_on',
    label: 'Due Date',
    description: 'Due date of the task.',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: 'YEAR_MONTH_DAY',
    }
  },
  {
    name: 'completed_at',
    label: 'Completion Date',
    description: 'Date the task was completed.',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: 'YEAR_MONTH_DAY',
    }
  },
  {
    name: 'notes',
    label: 'Task Description',
    description: 'The description of the task.',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION'
    }
  }
];

function getSchema(request) {
  return { schema: asanaSchema };
};

function getData(request) {
  // Create schema for requested fields
  var requestedSchema = request.fields.map(function (field) {
    for (var i = 0; i < asanaSchema.length; i++) {
      if (asanaSchema[i].name == field.name) {
        return asanaSchema[i];
      }
    }
  });
   
  // Fetch and parse data from API  
  var settings = {
  "async": true,
  "crossDomain": true,
  "method": "GET",
  "headers": {
    "Authorization": "Bearer " + getAsanaService().getAccessToken(),
    "Cache-Control": "no-cache",
    }
  };
  try {
    var url = "https://app.asana.com/api/1.0/tasks?opt_fields=id,created_at,modified_at,name,notes,assignee.id,assignee.name,completed,assignee_status,completed_at,due_on,due_at,projects.id,projects.name,memberships.section.name,tags,tags.name,workspace.id,workspace.name,num_hearts,parent,parent.name,hearts,followers.id,followers.name,liked&project="+
      request.configParams.projectId;
    var response = UrlFetchApp.fetch(url, settings).getContentText();
    parsedResponse = JSON.parse(response).data;
  } catch(e) {
    resetAuth();
    logConnectorError(e, 'data_fetch_error'); // Log to Stackdriver.
    throwConnectorError("There was an error requesting data. Please try again.", true);
    Logger.log(e);
  };
 
  
  // Transform parsed data and filter for requested fields
  var requestedData = parsedResponse.map(function(task) {
    var values = [];
    requestedSchema.forEach(function (field) {
      
      adj_task = transformData(task);
      
      if (adj_task['name'].substr(adj_task['name'].length - 1) != ':') { // remove sections
        switch (field.name) {
          case 'name':
            values.push(adj_task['name']);
            break;
          case 'assignee':
            values.push(adj_task['assignee']);
            break;
          case 'due_on':
            values.push(adj_task['due_on']);
            break;
          case 'completed_at':
            values.push(adj_task['completed_at']);
            break;
          case 'notes':
            values.push(adj_task['notes']);
            break;
          default:
            values.push('');
        };
      } else {
        values.push('');
      };
    });
    return { values: values };
  });
  
  return {
    schema: requestedSchema,
    rows: requestedData
  };
};

/**
* Throws an error that complies with the community connector spec.
* @param {string} message The error message.
* @param {boolean} userSafe Determines whether this message is safe to show
*     to non-admin users of the connector. true to show the message, false
*     otherwise. false by default.
*/
function throwConnectorError(message, userSafe) {
  userSafe = (typeof userSafe !== 'undefined' &&
              typeof userSafe === 'boolean') ?  userSafe : false;
  if (userSafe) {
    message = 'DS_USER:' + message;
  }
  
  throw new Error(message);
};

/**
* Log an error that complies with the community connector spec.
* @param {Error} originalError The original error that occurred.
* @param {string} message Additional details about the error to include in
*    the log entry.
*/
function logConnectorError(originalError, message) {
  var logEntry = [
    'Original error (Message): ',
    originalError,
    '(', message, ')'
  ];
  console.error(logEntry.join('')); // Log to Stackdriver.
};