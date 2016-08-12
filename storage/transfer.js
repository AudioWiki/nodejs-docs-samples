// Copyright 2015-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

// [START all]
// [START setup]
var moment = require('moment');
var google = require('googleapis');

// Instantiate a storage client
var storagetransfer = google.storagetransfer('v1');
// [END setup]

// [START auth]
function auth (callback) {
  google.auth.getApplicationDefault(function (err, authClient) {
    if (err) {
      return callback(err);
    }

    // The createScopedRequired method returns true when running on GAE or a
    // local developer machine. In that case, the desired scopes must be passed
    // in manually. When the code is  running in GCE or a Managed VM, the scopes
    // are pulled from the GCE metadata server.
    // See https://cloud.google.com/compute/docs/authentication for more
    // information.
    if (authClient.createScopedRequired && authClient.createScopedRequired()) {
      // Scopes can be specified either as an array or as a single,
      // space-delimited string.
      authClient = authClient.createScoped([
        'https://www.googleapis.com/auth/cloud-platform'
      ]);
    }
    callback(null, authClient);
  });
}
// [END auth]

// [START create_transfer_job]
/**
 * Review the transfer operations associated with a transfer job.
 *
 * @param {string} srcBucketName The name of the source bucket.
 * @param {string} destBucketName The name of the destination bucket.
 * @param {string} [description] Optional description for the new transfer job.
 * @param {function} callback The callback function.
 */
function createTransferJob (srcBucketName, destBucketName, date, time, description, callback) {
  if (!srcBucketName) {
    return callback(new Error('"srcBucketName" is required!'));
  } else if (!destBucketName) {
    return callback(new Error('"destBucketName" is required!'));
  }

  var startDate = moment(date, 'YYYY/MM/DD');
  var transferTime = moment(time, 'HH:mm');

  auth(function (err, authClient) {
    if (err) {
      return callback(err);
    }

    var transferJob = {
      projectId: process.env.GCLOUD_PROJECT,
      status: 'ENABLED',
      transferSpec: {
        gcsDataSource: {
          bucketName: srcBucketName
        },
        gcsDataSink: {
          bucketName: destBucketName
        },
        transferOptions: {
          deleteObjectsFromSourceAfterTransfer: false
        }
      },
      schedule: {
        scheduleStartDate: {
          year: startDate.year(),
          month: startDate.month() + 1,
          day: startDate.date()
        },
        startTimeOfDay: {
          hours: transferTime.hours(),
          minutes: transferTime.minutes()
        }
      }
    };

    if (description) {
      transferJob.description = description;
    }

    console.log(JSON.stringify(transferJob, null, 2));

    storagetransfer.transferJobs.create({
      auth: authClient,
      resource: transferJob
    }, function (err, job, apiResponse) {
      if (err) {
        return callback(err);
      }

      console.log(JSON.stringify(job, null, 2));
      console.log('Created job');
      return callback(null, job);
    });
  });
}
// [END create_transfer_job]

// [START get_job_status]
/**
 * Review the transfer operations associated with a transfer job.
 *
 * @param {string} [jobName] An optional job name to filter by.
 * @param {function} callback The callback function.
 */
function getJobStatus (jobName, callback) {
  auth(function (err, authClient) {
    if (err) {
      return callback(err);
    }

    var filter = {
      project_id: process.env.GCLOUD_PROJECT
    };

    if (jobName) {
      filter.job_names = [jobName];
    }

    storagetransfer.transferOperations.list({
      name: 'transferOperations',
      filter: JSON.stringify(filter),
      auth: authClient
    }, function (err, result, apiResponse) {
      if (err || apiResponse.statusCode === 404) {
        return callback(err || 'Not Found!');
      } else if (!result.operations || !result.operations.length) {
        return callback(null, 'No operations found.');
      }

      console.log('Found %d operations!', result.operations.length);
      return callback(null, result);
    });
  });
}
// [END get_job_status]

// [START usage]
function printUsage () {
  console.log('Usage: node encryption COMMAND [ARGS...]');
  console.log('\nCommands:\n');
  console.log('\tcreate SRC_BUCKET_NAME DEST_BUCKET_NAME DATE TIME [DESCRIPTION]');
  console.log('\tstatus JOB_ID');
  console.log('\nExamples:\n');
  console.log('\tnode transfer create my-bucket my-other-bucket 2016/08/12 16:30 "Move my files"');
  console.log('\tnode transfer status 1234567890');
}
// [END usage]

// The command-line program
var program = {
  createTransferJob: createTransferJob,
  getJobStatus: getJobStatus,
  printUsage: printUsage,

  // Executed when this program is run from the command-line
  main: function (args, cb) {
    var command = args.shift();
    if (command === 'create') {
      this.createTransferJob(args[0], args[1], args[2], args[3], args[4], cb);
    } else if (command === 'status') {
      this.getJobStatus(args[0], cb);
    } else {
      this.printUsage();
    }
  }
};

if (module === require.main) {
  program.main(process.argv.slice(2), console.log);
}
// [END all]

module.exports = program;
