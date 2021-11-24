<template>
  <div id="sub">
    <div v-if="selectedPostId">
      <div v-if="selectedPost.isFetching">Loading post {{selectedPostId}}...</div>
      <div v-if="selectedPost.isSuccess">
        <h2>{{ selectedPost.data.title }}</h2>
        <p>{{ selectedPost.data.body }}</p>
      </div>
      <div v-if="selectedPost.isError">{{selectedPost.error.message}}</div>
    </div>
    <h2>List</h2>
    <button @click="incr">{{ page }}</button>
    <div v-if="allPosts.isUninitialized">Initializing...</div>
    <div v-if="allPosts.isFetching">Loading...</div>
    <ul v-if="!allPosts.isLoading">
      <li v-for="post in allPosts.data" :key="post.id">
        {{ post.title}}
        <button @click="selectPost(post.id)">Go!</button>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import { Post } from './models';

export default Vue.extend({
  data() {
    return {
      page: 1,
      selectedPostId: null as number | null,
    };
  },
  computed: {
    allPosts: Post.useFetchAll(function () {
      return {
        page: this.page,
      };
    }, {
      pollingInterval: 10000,
      refetchOnMount: true,
    }),

    selectedPost: Post.useFetchById(function () {
      return this.selectedPostId;
    }, {
      skip() { return this.selectedPostId === null; },
    }),
  },
  methods: {
    incr() {
      console.log(this.selectedPost);
      this.page += 1;
    },
    selectPost(postId: number) {
      this.selectedPostId = postId;
    },
  },
});
</script>
