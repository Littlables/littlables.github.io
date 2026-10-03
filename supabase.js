    const SUPABASE_CONFIG = Object.freeze({
      url: 'https://vehbstectghtqqyiitmi.supabase.co',
      publishableKey: 'sb_publishable_NNWeMzQK6GCcsAl4Ij1iiw_1sT0v44k',
      tableName: 'article_reactions'
    });

    let supabaseClient = null;
    let realtimeChannel = null;

    if (
      window.supabase &&
      SUPABASE_CONFIG.url &&
      SUPABASE_CONFIG.publishableKey.startsWith('sb_publishable_') &&
      SUPABASE_CONFIG.publishableKey !== 'sb_publishable_REPLACE_WITH_PROJECT_KEY'
    ) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
        console.log('Supabase client initialized successfully.');
        setupRealtimeSubscription();
      } catch (err) {
        console.warn('Supabase initialization failed:', err);
      }
    }

    function setupRealtimeSubscription() {
      if (!supabaseClient || realtimeChannel) return;
      realtimeChannel = supabaseClient
        .channel('realtime_reactions')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: SUPABASE_CONFIG.tableName },
          payload => {
            const row = payload.new;
            if (row && row.story_id && row.reaction_type) {
              const countEl = document.querySelector(`.reaction-count[data-story="${row.story_id}"][data-type="${row.reaction_type}"]`);
              if (countEl) {
                countEl.textContent = row.count;
                const pill = countEl.closest('.reaction-pill');
                if (pill) {
                  pill.classList.add('pop-bounce');
                  setTimeout(() => pill.classList.remove('pop-bounce'), 400);
                }
              }
              localStorage.setItem(`rec_${row.story_id}_${row.reaction_type}`, row.count);
            }
          }
        )
        .subscribe();
    }

    function getStoryId(title, link) {
      const str = ((link || '') + (title || '')).toLowerCase().trim();
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return 's_' + Math.abs(hash).toString(36).slice(0, 10);
    }

    function getReactionCount(storyId, type, seedBase) {
      const key = `rec_${storyId}_${type}`;
      const stored = localStorage.getItem(key);
      if (stored !== null) return parseInt(stored, 10);
      const seed = Math.floor(Math.abs(seedBase * 7 + (type === 'love' ? 14 : type === 'mind' ? 9 : 21)) % 38) + 4;
      localStorage.setItem(key, seed);
      return seed;
    }

    function hasUserReacted(storyId, type) {
      return localStorage.getItem(`voted_${storyId}_${type}`) === 'true';
    }

    async function syncReactionsFromSupabase(storyIds) {
      if (!supabaseClient || !storyIds || !storyIds.length) return;
      try {
        const { data, error } = await supabaseClient
          .from(SUPABASE_CONFIG.tableName)
          .select('story_id, reaction_type, count')
          .in('story_id', storyIds);

        if (error) throw error;
        if (data && data.length) {
          data.forEach(row => {
            const countEl = document.querySelector(`.reaction-count[data-story="${row.story_id}"][data-type="${row.reaction_type}"]`);
            if (countEl) countEl.textContent = row.count;
            localStorage.setItem(`rec_${row.story_id}_${row.reaction_type}`, row.count);
          });
        }
      } catch (err) {
        console.warn('Supabase reaction sync failed:', err);
      }
    }

    async function handleReaction(btn, storyId, type) {
      btn.classList.add('pop-bounce');
      setTimeout(() => btn.classList.remove('pop-bounce'), 450);

      const countEl = btn.querySelector('.reaction-count');
      const localCount = parseInt(countEl.textContent, 10) || 0;
      const alreadyVoted = hasUserReacted(storyId, type);

      if (alreadyVoted) {
        btn.classList.remove('voted');
        localStorage.removeItem(`voted_${storyId}_${type}`);
        countEl.textContent = Math.max(0, localCount - 1);

        if (supabaseClient) {
          try {
            const { data: dbCount, error } = await supabaseClient.rpc('decrement_reaction', {
              p_story_id: storyId,
              p_reaction_type: type
            });
            if (error || typeof dbCount !== 'number') throw error || new Error('Invalid response from RPC');
            countEl.textContent = dbCount;
            localStorage.setItem(`rec_${storyId}_${type}`, dbCount);
          } catch (err) {
            console.warn('Reaction decrement failed:', err);
            btn.classList.add('voted');
            localStorage.setItem(`voted_${storyId}_${type}`, 'true');
            countEl.textContent = localCount;
          }
        }
      } else {
        btn.classList.add('voted');
        localStorage.setItem(`voted_${storyId}_${type}`, 'true');
        countEl.textContent = localCount + 1;

        if (supabaseClient) {
          try {
            const { data: dbCount, error } = await supabaseClient.rpc('increment_reaction', {
              p_story_id: storyId,
              p_reaction_type: type
            });
            if (error || typeof dbCount !== 'number') throw error || new Error('Invalid response from RPC');
            countEl.textContent = dbCount;
            localStorage.setItem(`rec_${storyId}_${type}`, dbCount);
          } catch (err) {
            console.warn('Reaction increment failed:', err);
            btn.classList.remove('voted');
            localStorage.removeItem(`voted_${storyId}_${type}`);
            countEl.textContent = localCount;
          }
        }
      }
    }

    async function syncThemeToUserProfile(themeId) {
      if (!supabaseClient || !supabaseClient.auth) return;
      try {
        const { data, error: authError } = await supabaseClient.auth.getUser();
        if (authError) throw authError;
        if (data && data.user) {
          const { error } = await supabaseClient
            .from('user_profiles')
            .upsert({ user_id: data.user.id, preferred_theme: themeId, updated_at: new Date().toISOString() });
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Supabase theme profile sync failed:', err);
      }
    }
