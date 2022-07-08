#!/bin/bash

# Copyright 2017-2021 EPAM Systems, Inc. (https://www.epam.com/)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

# sudo apt-get install gcc libpq-dev -y
# sudo apt-get install python-dev  python-pip -y
# sudo apt-get install python3-dev python3-pip python3-venv python3-wheel -y
# pip3 install wheel

# echo `python -V`
# echo `pip -V`
#sudo -H python -m ensurepip
# pip install virtualenv
# python -m virtualenv venv
# source venv/bin/activate
# echo `pip -V`
# echo `python -V`
# python -m pip install wheel
# python -m pip install awscli==1.14.56 
# python -m pip install mkdocs

API_STATIC_PATH=api/src/main/resources/static
rm -rf ${API_STATIC_PATH}/*
rm -rf build/install/dist/*
mkdir -p ${API_STATIC_PATH}

_OSX_CLI_TAR_NAME=pipe-osx-full.6.tar.gz
#_OSX_CLI_TAR_NAME=pipe-osx-full.48.tar.gz
_OSX_CLI_PATH=$(mktemp -d)
aws s3 cp s3://cloud-pipeline-oss-test/temp/${_OSX_CLI_TAR_NAME} ${_OSX_CLI_PATH}/
tar -zxf $_OSX_CLI_PATH/$_OSX_CLI_TAR_NAME -C $_OSX_CLI_PATH

sudo mv $_OSX_CLI_PATH/dist/dist-file/pipe-osx ${API_STATIC_PATH}/pipe-osx
sudo mv $_OSX_CLI_PATH/dist/dist-folder/pipe-osx.tar.gz ${API_STATIC_PATH}/pipe-osx.tar.gz

#_BUILD_DOCKER_IMAGE="${CP_DOCKER_DIST_SRV}lifescience/cloud-pipeline:python2.7-centos6" 
#sudo ./gradlew -PbuildNumber=$GITHUB_RUN_NUMBER.$GITHUB_SHA --info -Pprofile=release pipe-cli:buildLinux --no-daemon -x :pipe-cli:test
_BUILD_DOCKER_IMAGE="lifescience/cloud-pipeline:python2.7-centos6" ./gradlew -PbuildNumber=$GITHUB_RUN_NUMBER.$GITHUB_SHA -Pprofile=release pipe-cli:buildLinux --no-daemon -x :pipe-cli:test

mv pipe-cli/dist/dist-file/pipe ${API_STATIC_PATH}/pipe-el6
mv pipe-cli/dist/dist-folder/pipe.tar.gz ${API_STATIC_PATH}/pipe-el6.tar.gz

export JAVA_HOME=`/usr/libexec/java_home -v 1.8`

./gradlew distTar   -PbuildNumber=$GITHUB_RUN_NUMBER.$GITHUB_SHA \
                    -Pprofile=release \
                    -x test \
                    -Pfast \
                    --no-daemon \
                    --force

#removed sudo
#sudo mv pipe-cli/dist/dist-file/pipe ${API_STATIC_PATH}/pipe-el6
#sudo mv pipe-cli/dist/dist-folder/pipe.tar.gz ${API_STATIC_PATH}/pipe-el6.tar.gz
#mv pipe-cli/dist/dist-file/pipe ${API_STATIC_PATH}/pipe-el6
#mv pipe-cli/dist/dist-folder/pipe.tar.gz ${API_STATIC_PATH}/pipe-el6.tar.gz

ls -a pipe-cli/
ls -a pipe-cli/dist/
ls -a pipe-cli/dist/dist-file/
ls -a pipe-cli/dist/dist-folder/

# sudo ./gradlew distTar   -PbuildNumber=$GITHUB_RUN_NUMBER.$GITHUB_SHA \
#                     -Pprofile=release \
#                     -x test \
#                     -Pfast \
#                     --no-daemon