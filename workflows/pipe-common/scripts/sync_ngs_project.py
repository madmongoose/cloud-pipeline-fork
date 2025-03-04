import datetime
import glob
import json
import os
import time

from pipeline import Logger, PipelineAPI, common

DATE_PATTERN = '%Y-%m-%d %H:%M:%S.%f'

EVENT_FAILURE = 'Failure'
EVENT_SUCCESS = 'Success'

DEFAULT_FOLDERS = ['Config', 'Data', 'Images', 'InterOp', 'Logs', 'RTALogs',
                   'Recipe', 'Thumbnail_Images', 'Stats', 'Reports']
REQUIRED_FIELDS = ['BCLs', 'Results', 'SampleSheet',   'ExperimentType', 'ExperimentName', 'PairedEnd', 'ConfigFile']

EMAIL_TEMPLATE = '''
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <style>
        table,
        td {{
            border: 1px solid black;
            border-collapse: collapse;
            padding: 5px;
        }}
    </style>
</head>

<body>
<p>Dear user,</p>
<p>*** This is a system generated email, do not reply to this email ***</p>
<p> Please find list of the latest metadata synchronization events for NGS data: </p>
<p>
<table>
    <tr>
        <td><b>MachineRun</b></td>
        <td><b>Event</b></td>
        <td><b>Status</b></td>
        <td><b>Message</b></td>
    </tr>
    {events}
</table>
</p>
<p>You can verify the NGS data status: <a href="{api}/#/folder/{folder_id}/metadata/MachineRun">Machine Runs</a></p>
<p>Best regards,</p>
<p>{deploy_name} Platform</p>
</body>

</html>
'''

EVENT_PATTERN = '''
 <tr>
            <td>{run}</td>
            <td>{event}</td>
            <td>{status}</td>
            <td>{message}</td>
 </tr>
'''


class Event(object):
    def __init__(self, machine_run, type, status, message=None):
        self.machine_run = machine_run
        self.type = type
        self.status = status
        self.message = message


class Settings(object):

    def __init__(self, api, project_id, cloud_path, config_path, r_script, db_path_prefix, notify_users,
                 configuration_id, configuration_entry_name, launch_from_date, processed_to_date,
                 deploy_name):
        self.complete_token_file_name = api.get_preference('ngs.preprocessing.completion.mark.file.default.name')['value']
        self.sample_sheet_glob = api.get_preference('ngs.preprocessing.samplesheet.pattern')['value']
        self.machine_run_class = api.get_preference('ngs.preprocessing.machine.run.metadata.class.name')['value']
        self.machine_run_class_id = int(api.get_preference('ngs.preprocessing.machine.run.metadata.class.id')['value'])
        self.demultiplex_file = api.get_preference('ngs.preprocessing.demultiplex.config.pattern')['value']
        self.config_path = config_path
        self.project_id = int(project_id)
        self.cloud_path = cloud_path
        self.r_script = r_script
        self.db_path_prefix = db_path_prefix
        self.notify_users = notify_users.split(',')
        self.configuration_id = configuration_id
        self.configuration_entry_name = configuration_entry_name
        self.launch_from_date = datetime.datetime.strptime(launch_from_date, '%y%m%d') if launch_from_date else None
        self.processed_to_date = datetime.datetime.strptime(processed_to_date, '%y%m%d') if processed_to_date else None
        self.deploy_name = deploy_name


class MachineRun(object):

    def __init__(self, run_folder, machine_run, settings, api, notifications):
        self.run_folder = run_folder
        self.machine_run = machine_run
        self.settings = settings
        self.api = api
        self.notifications = notifications

    def sync(self):
        try:
            Logger.info('\nSynchronizing machine run %s.' % self.machine_run, task_name=self.machine_run)
            completion_mark = os.path.join(self.run_folder, self.settings.complete_token_file_name)
            if not os.path.isfile(completion_mark):
                Logger.info('Completion token is not present for machine run %s. Skipping processing.'
                            % self.machine_run, task_name=self.machine_run)
                return
            Logger.info('Completion token is present for machine run %s.' % self.machine_run,
                        task_name=self.machine_run)
            sample_sheets = self.find_sample_sheet(self.run_folder)
            trigger_run = len(sample_sheets) == 0
            if len(sample_sheets) == 0:
                Logger.info('Sample sheet is not present for machine run %s. It will be generated.' %
                            self.machine_run, task_name=self.machine_run)
                sample_sheets = self.generate_sample_sheet(self.machine_run, self.run_folder)
            else:
                Logger.info('%d sample sheets are present for machine run %s.' % (len(sample_sheets),
                                                                                  self.machine_run),
                            task_name=self.machine_run)
            self.register_metadata(self.machine_run, self.run_folder, sample_sheets, trigger_run)
            Logger.success('Finished % synchronization' % self.machine_run, task_name=self.machine_run)
        except Exception as e:
            Logger.fail('An error occurred during machine run processing %s: %s.' % (self.machine_run, str(e.message)),
                        task_name=self.machine_run)
            self.notifications.append(Event(self.machine_run, 'Metadata Created', EVENT_FAILURE, message=str(e.message)))

    def find_sample_sheet(self, run_folder):
        return [os.path.basename(s) for s in glob.glob(os.path.join(run_folder, self.settings.sample_sheet_glob))]

    def generate_sample_sheet(self, machine_run, run_folder):
        # run Rscript
        # check results
        command = 'cd %s && Rscript %s %s' % (run_folder, self.settings.r_script,
                                              self.settings.db_path_prefix + machine_run)
        Logger.info('Executing command %s.' % command, task_name=self.machine_run)
        exit_code, out, err = common.execute_cmd_command_and_get_stdout_stderr(command,
                                                                               silent=True)
        if exit_code != 0:
            return self.handle_sample_sheet_error(machine_run, err, out)
        generated = self.find_sample_sheet(run_folder)
        if not generated:
            return self.handle_sample_sheet_error(machine_run, err, out)
        self.notifications.append(Event(self.machine_run, 'SampleSheet generated', EVENT_SUCCESS))
        return generated

    def handle_sample_sheet_error(self, machine_run, err, out):
        Logger.fail('Failed to generate sample sheet for %s.' % machine_run, task_name=self.machine_run)
        metadata = self.api.find_metadata_entity(self.settings.project_id, machine_run, self.settings.machine_run_class)
        if metadata:
            Logger.info('Metadata for class is already registered, skipping sample sheet error.')
            return [None]
        output = ''
        if err:
            output += str(err)
        if out:
            output = output + '\n' + str(out)
            Logger.warn(str(output), task_name=self.machine_run)
        self.notifications.append(Event(self.machine_run, 'SampleSheet generated', EVENT_FAILURE, message=output))
        return [None]

    def register_metadata(self, machine_run, run_folder, sample_sheets, trigger_run):
        results = self.check_results(run_folder)
        for sample_sheet in sample_sheets:
            id = machine_run + ':' + sample_sheet if sample_sheet else machine_run
            metadata = self.api.find_metadata_entity(self.settings.project_id, id, self.settings.machine_run_class)
            if metadata:
                Logger.info('Machine run %s is already registered.' % machine_run, task_name=self.machine_run)
                return
            demultiplex_file, demultiplex_config = self.find_demultiplex_config(run_folder)
            sequence_date = self.parse_seq_date(machine_run)
            data = {
                'MachineRunID': {'type': 'string', 'value': machine_run},
                'MachineRun': {'type': 'Path', 'value': os.path.join(self.settings.cloud_path, machine_run)},
                'Results':  self.build_results(machine_run, results, demultiplex_config),
                'Output': {'type': 'Path', 'value': os.path.join(self.settings.cloud_path, machine_run)},
                'Processed': {'type': 'string', 'value': 'Yes' if results or self.is_before_processed_date(sequence_date) else 'No'},
                'SampleSheet': {'type': 'Path', 'value':
                    os.path.join(self.settings.cloud_path, machine_run, sample_sheet) if sample_sheet else None},
                'ExperimentType': {'type': 'string', 'value': 'multiple'},
                'PairedEnd': {'type': 'string', 'value': 'false'},
                'ConfigFile': {'type': 'Path', 'value':
                    os.path.join(self.settings.cloud_path, machine_run, demultiplex_file) if demultiplex_file else None},
                'SequenceDate': {'type': 'Date', 'value': sequence_date}
            }
            entity = {
                'parentId': self.settings.project_id,
                'classId': self.settings.machine_run_class_id,
                'className': self.settings.machine_run_class,
                'externalId': id,
                'entityName': id,
                'data': data
            }
            metadata_entity = self.api.save_metadata_entity(entity)
            Logger.info('Created metadata for machine run %s with sample sheet %s.' % (machine_run, sample_sheet),
                        task_name=self.machine_run)
            self.notifications.append(Event(self.machine_run, 'Metadata created', EVENT_SUCCESS))
            if not results and trigger_run and self.settings.configuration_id and sample_sheet is not None:
                self.run_analysis(metadata_entity)
            failure_events = ['%s:%s' % (event.type, event.message)
                              for event in self.notifications
                              if event.status == EVENT_FAILURE and event.machine_run == self.machine_run]
            if failure_events:
                # in case pipeline is launched wait for status update
                time.sleep(5)
                loaded = self.api.find_metadata_entity(self.settings.project_id, id, self.settings.machine_run_class)
                entity['entityId'] = metadata_entity['id']
                entity['data'] = loaded['data']
                entity['data']['Errors'] = {'type': 'string', 'value': '; '.join(failure_events)}
                self.api.save_metadata_entity(entity)

    def check_results(self, run_folder):
        res = []
        for dir in os.listdir(run_folder):
            # Consider all non-default folders to be results
            if os.path.isdir(os.path.join(run_folder, dir)) and dir not in DEFAULT_FOLDERS:
                res.append(dir)
        return res

    def is_before_processed_date(self, sequence_date):
        if sequence_date is None or self.settings.processed_to_date is None:
            return False
        return datetime.datetime.strptime(sequence_date, DATE_PATTERN) <= self.settings.processed_to_date

    def parse_seq_date(self, machine_run):
        if '_' in machine_run:
            try:
                text = machine_run.split('_')[0]
                return datetime.datetime.strptime(text, '%y%m%d').strftime(DATE_PATTERN)
            except Exception as e:
                return None
        return None

    def run_analysis(self, metadata_entity):
        Logger.info('Launching analysis for machine run %s.' % self.machine_run, task_name=self.machine_run)
        if self.settings.launch_from_date:
            seq_date = metadata_entity['data']['SequenceDate']['value']
            if seq_date is None or datetime.datetime.strptime(seq_date, DATE_PATTERN) < self.settings.launch_from_date:
                msg = 'Analysis for machine run %s won\'t be launched as sequence date %s is before configured theshold %s' \
                      % (self.machine_run, str(seq_date), self.settings.launch_from_date.strftime(DATE_PATTERN))
                Logger.info(msg, task_name=self.machine_run)
                return
        for field in REQUIRED_FIELDS:
            if field not in metadata_entity['data'] or metadata_entity['data'][field] is None:
                msg = 'Required metadata field %s in missing for machine run %s. Analysis won\'t be launched,' % \
                      (field, self.machine_run)
                raise RuntimeError(msg)
        try:
            configuration = self.api.load_configuration(int(self.settings.configuration_id))
            target_entry = None
            for entry in configuration['entries']:
                if entry['configName'] == self.settings.configuration_entry_name:
                    target_entry = entry
            if not target_entry:
                raise RuntimeError('Analysis configuration is misconfigured. Failed to find configuration entry %s.' % self.settings.configuration_entry_name)
            configuration['entries'] = [target_entry]
            data = {
                "entitiesIds": [int(metadata_entity['id'])],
                "entries": [target_entry],
                "folderId": self.settings.project_id,
                "id": int(configuration['id']),
                "metadataClass": self.settings.machine_run_class,
                "notifications": self.build_run_notification(metadata_entity)
            }
            result = self.api.run_configuration(data)
            msg = 'Successfully launched analysis for machine run %s. Run id: %d.' % (self.machine_run, result[0]['id'])
            Logger.info(msg, task_name=self.machine_run)
            self.notifications.append(Event(self.machine_run, 'Analysis launch', EVENT_SUCCESS, message=msg))
        except Exception as e:
            Logger.warn('Failed to launch analysis for machine run %s. Error: %s' % (self.machine_run, str(e.message)),
                                                                                     task_name=self.machine_run)
            self.notifications.append(Event(self.machine_run, 'Analysis launch', 'Failure', message=str(e.message)))

    def build_run_notification(self, metadata_entity):
        if not self.settings.notify_users:
            return None
        notification = {
            'type': 'PIPELINE_RUN_STATUS',
            'triggerStatuses': ['SUCCESS', 'FAILURE', 'STOPPED'],
            'recipients': self.settings.notify_users,
            'subject': '[%s] NGS data analysis finished for Machine Run: %s' %
                       (self.settings.deploy_name, metadata_entity['data']['MachineRunID']['value'])
        }
        return [notification]

    def build_results(self, machine_run, results, demultiplex_config):
        if not results:
            if demultiplex_config:
                experiments = [exp for exp in demultiplex_config.keys()]
                return self.build_res_value(experiments, machine_run)
            return self.build_res_value([''], machine_run)
        return self.build_res_value(results, machine_run)

    def build_res_value(self, results, machine_run):
        if len(results) == 1:
            return {'type': 'Path', 'value': os.path.join(self.settings.cloud_path, machine_run, results[0])}
        value = json.dumps([os.path.join(self.settings.cloud_path, machine_run, res) for res in results])
        return {'type': 'Array[Path]', 'value': value}

    def find_demultiplex_config(self, run_folder):
        result = {}
        files = [os.path.basename(s) for s in glob.glob(os.path.join(run_folder, self.settings.demultiplex_file))]
        if not files:
            return None, result
        if len(files) > 1:
            Logger.warn('Multiple demultiplex files found for machine run %s: %s. First one will be processed.' %
                        (self.machine_run, ','.join(files)), task_name=self.machine_run)
        demultiplex_config = files[0]
        Logger.info('Reading demultiplex configuration file form %s.' % os.path.join(run_folder, demultiplex_config),
                    task_name=self.machine_run)
        with open(os.path.join(run_folder, demultiplex_config), 'r') as config:
            for line in config.readlines():
                if not line or '\t' not in line:
                    continue
                parts = line.split('\t')
                name = parts[0]
                path = parts[1]
                result[name] = path
        return demultiplex_config, result


class NGSSync(object):

    def __init__(self, api, settings):
        self.api = api
        self.settings = settings

    def sync_ngs_project(self, folder):
        machine_run_folders = [directory for directory in os.listdir(folder) if os.path.isdir(folder + directory)]
        notifications = []
        for machine_run in machine_run_folders:
            MachineRun(os.path.join(folder, machine_run), machine_run, self.settings, self.api, notifications).sync()
        if notifications and self.settings.notify_users:
            Logger.info('Sending notification to %s.' % ','.join(self.settings.notify_users))
            self.api.create_notification('[%s]: NGS metadata synchronization' % self.settings.deploy_name,
                                         self.build_notification_text(notifications),
                                         self.settings.notify_users[0],
                                         copy_users=self.settings.notify_users[1:] if len(
                                             self.settings.notify_users) > 0 else None,
                                         )

    def build_notification_text(self, notifications):
        event_str = ''
        for event in notifications:
            event_str += EVENT_PATTERN.format(**{'run': event.machine_run,
                                                 'event': event.type,
                                                 'status': event.status,
                                                 'message': event.message})

        return EMAIL_TEMPLATE.format(**{'events': event_str,
                                        'api': self.api.api_url.rstrip('/').replace('/restapi', ''),
                                        'folder_id': str(self.settings.project_id),
                                        'deploy_name': self.settings.deploy_name})


def get_required_env_var(name):
    val = os.getenv(name)
    if val is None:
        raise RuntimeError('Required environment variable "%s" is not set.' % name)
    return val


def main():
    folder = get_required_env_var('NGS_SYNC_FOLDER')
    project_id = get_required_env_var('NGS_SYNC_PROJECT_ID')
    cloud_path = get_required_env_var('NGS_SYNC_CLOUD_PATH')
    config_path = get_required_env_var('NGS_SYNC_CONFIG_PATH')
    r_script = get_required_env_var('NGS_SYNC_R_SCRIPT')
    db_path_prefix = os.getenv('NGS_SYNC_DB_PATH_PREFIX', '')
    notify_users = os.getenv('NGS_SYNC_NOTIFY_USERS', '')
    configuration_id = os.getenv('NGS_SYNC_CONFIG_ID', None)
    configuration_entry_name = os.getenv('NGS_SYNC_CONFIG_ENTRY_NAME', 'default')
    launch_from_date = os.getenv('NGS_SYNC_LAUNCH_START', None)
    processed_to_date = os.getenv('NGS_SYNC_PROCESSED_TO_DATE', None)
    deploy_name = os.getenv('NGS_SYNC_DEPLOY_NAME', 'Cloud Pipeline')
    api = PipelineAPI(api_url=os.environ['API'], log_dir='sync_ngs')
    settings = Settings(api, project_id, cloud_path, config_path, r_script, db_path_prefix, notify_users,
                        configuration_id, configuration_entry_name, launch_from_date, processed_to_date,
                        deploy_name)
    NGSSync(api, settings).sync_ngs_project(folder)


if __name__ == '__main__':
    main()

