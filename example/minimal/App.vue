<template>
  <div id="app">
    <div v-if="isFetching">Loading...</div>
    <ul v-if="!isLoading">
      <li v-for="item in posts" :key="item.id">
        {{ item.title}}
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
      posts: [] as Post[],
      isLoading: false,
      isFetching: false,
    };
  },
  async mounted() {
    this.posts = await Post.fetchAll();
  },
});
</script>
