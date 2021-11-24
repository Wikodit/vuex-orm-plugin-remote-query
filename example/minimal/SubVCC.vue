<template>
  <div id="sub">
    <div v-if="selectedPost.isSuccess">
      <h2>{{ selectedPost.title }}</h2>
      <p>{{ selectedPost.description }}</p>
    </div>
    <h2>List</h2>
    <button @click="incr">{{ page }}</button>
    <div v-if="allPosts.isUninitialized">Initializing...</div>
    <div v-if="allPosts.isFetching">Loading...</div>
    <ul v-if="!allPosts.isLoading">
      <li v-for="post in allPosts.data" :key="post.id" @click="selectPost(post.id)">
        {{ post.title}}
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import Component from 'vue-class-component';
import { Post } from './models';

@Component
class SubVCC extends Vue {
  public page = 1;

  public selectedPostId: number | null = null;

  get allPosts() {
    return Post.useFetchAll({
      page: this.page,
    }, {
      pollingInterval: 10000,
      refetchOnMount: true,
    }).get?.call(this);
  }

  get selectedPost() {
    return Post.useFetchById(
      this.selectedPostId,
      { skip() { return this.selectedPostId === null; } },
    ).get?.call(this);
  }

  incr() {
    this.page += 1;
  }

  selectPost(postId: number) {
    this.selectedPostId = postId;
  }
}

export default SubVCC;
</script>
