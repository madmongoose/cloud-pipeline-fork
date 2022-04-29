/*
 * Copyright 2017-2022 EPAM Systems, Inc. (https://www.epam.com/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.epam.pipeline.manager.git.bibucket;

import com.epam.pipeline.entity.git.bitbucket.BitbucketCommits;
import com.epam.pipeline.entity.git.bitbucket.BitbucketRepository;
import com.epam.pipeline.entity.git.bitbucket.BitbucketTags;
import okhttp3.MultipartBody;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Multipart;
import retrofit2.http.POST;
import retrofit2.http.Part;
import retrofit2.http.Path;

public interface BitbucketApi {

    String WORKSPACE = "workspace";
    String NAME = "name";
    String COMMIT = "commit";
    String PATH = "path";

    @GET("/2.0/repositories/{workspace}/{name}")
    Call<BitbucketRepository> getRepository(@Path(WORKSPACE) String workspace, @Path(NAME) String name);

    @POST("/2.0/repositories/{workspace}/{name}")
    Call<BitbucketRepository> createRepository(@Path(WORKSPACE) String workspace, @Path(NAME) String name,
                                               @Body BitbucketRepository bitbucketRepository);

    @GET("/2.0/repositories/{workspace}/{name}/src/{commit}/{path}")
    Call<ResponseBody> getFileContents(@Path(WORKSPACE) String workspace, @Path(NAME) String name,
                                       @Path(COMMIT) String commit, @Path(PATH) String path);

    @Multipart
    @POST("/2.0/repositories/{workspace}/{name}/src")
    Call<ResponseBody> createFile(@Path(WORKSPACE) String workspace, @Path(NAME) String name,
                                  @Part MultipartBody.Part file);

    @GET("/2.0/repositories/{workspace}/{name}/refs/tags")
    Call<BitbucketTags> getTags(@Path(WORKSPACE) String workspace, @Path(NAME) String name);

    @GET("/2.0/repositories/{workspace}/{name}/commits")
    Call<BitbucketCommits> getCommits(@Path(WORKSPACE) String workspace, @Path(NAME) String name);
}
