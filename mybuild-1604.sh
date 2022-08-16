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

APPVEYOR_BUILD_NUMBER=6
APPVEYOR_REPO_COMMIT=12345678901234567890
APPVEYOR_REPO_NAME="madmongoose/cloud-pipeline-fork"
APPVEYOR_REPO_BRANCH="develop"

API_STATIC_PATH=api/src/main/resources/static
rm -rf ${API_STATIC_PATH}/*
rm -rf build/install/dist/*
mkdir -p ${API_STATIC_PATH}

echo "##################################################################################################################################step1"
ls ${API_STATIC_PATH}

_OSX_CLI_TAR_NAME=pipe-osx-full.$APPVEYOR_BUILD_NUMBER.tar.gz
_OSX_CLI_PATH=$(mktemp -d)
aws s3 cp s3://cloud-pipeline-oss-test/temp/${_OSX_CLI_TAR_NAME} ${_OSX_CLI_PATH}/
tar -zxf $_OSX_CLI_PATH/$_OSX_CLI_TAR_NAME -C $_OSX_CLI_PATH

echo "##################################################################################################################################step2"

mv $_OSX_CLI_PATH/dist/dist-file/pipe-osx ${API_STATIC_PATH}/pipe-osx
mv $_OSX_CLI_PATH/dist/dist-folder/pipe-osx.tar.gz ${API_STATIC_PATH}/pipe-osx.tar.gz

echo "##################################################################################################################################step3"
ls ${API_STATIC_PATH}/

_BUILD_DOCKER_IMAGE="${CP_DOCKER_DIST_SRV}lifescience/cloud-pipeline:python2.7-centos6" ./gradlew -PbuildNumber=${APPVEYOR_BUILD_NUMBER}.${APPVEYOR_REPO_COMMIT} -Pprofile=release pipe-cli:buildLinux --no-daemon -x :pipe-cli:test
mv pipe-cli/dist/dist-file/pipe ${API_STATIC_PATH}/pipe-el6
mv pipe-cli/dist/dist-folder/pipe.tar.gz ${API_STATIC_PATH}/pipe-el6.tar.gz

echo "##################################################################################################################################step4"
ls ${API_STATIC_PATH}/

./gradlew distTar   -PbuildNumber=${APPVEYOR_BUILD_NUMBER}.${APPVEYOR_REPO_COMMIT} \
                    -Pprofile=release \
                    -x test \
                    -Pfast \
                    --no-daemon \
                    -x client:buildUI \
                    -x pipe-cli:build \
                    -x pipe-cli:buildWin \

echo "##################################################################################################################################step5"
#-x api:bootRepackage
#-x data-sharing-service:api
ls ${API_STATIC_PATH}/

# if [ "$APPVEYOR_REPO_NAME" == "madmongoose/cloud-pipeline-fork" ]; then
#     DIST_TGZ_NAME=$(echo build/install/dist/cloud-pipeline*)

#     # Publish repackaged distribution tgz to S3 into builds/ prefix
#     # Only if it is one of the allowed branches and it is a push (not PR)
#     if [ "$APPVEYOR_REPO_BRANCH" == "develop" ] || [ "$APPVEYOR_REPO_BRANCH" == "master" ] || [[ "$APPVEYOR_REPO_BRANCH" == "release/"* ]] || [[ "$APPVEYOR_REPO_BRANCH" == "stage/"* ]]; then
#             aws s3 cp $DIST_TGZ_NAME s3://cloud-pipeline-oss-test/builds/${APPVEYOR_REPO_BRANCH}/
#     fi
# fi
