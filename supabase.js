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

    function hasUserReacted(storyId, type) {
      return localStorage.getItem(`voted_${storyId}_${type}`) === 'true';
    }

    async function syncReactionsFromSupabase(storyIds) {
      const types = ['love', 'mind', 'cozy'];
      const setCount = (storyId, type, count) => {
        const countEl = document.querySelector(`.reaction-count[data-story="${storyId}"][data-type="${type}"]`);
        if (countEl) countEl.textContent = String(count);
      };
      if (!storyIds || !storyIds.length) return;
      if (!supabaseClient) {
        document.querySelectorAll('.reaction-pill').forEach(button => { button.disabled = true; });
        document.querySelectorAll('.reaction-count').forEach(element => { element.textContent = '—'; });
        return;
      }
      try {
        storyIds.forEach(storyId => types.forEach(type => setCount(storyId, type, 0)));
        const { data, error } = await supabaseClient
          .from(SUPABASE_CONFIG.tableName)
          .select('story_id, reaction_type, count')
          .in('story_id', storyIds);

        if (error) throw error;
        if (data && data.length) {
          data.forEach(row => {
            setCount(row.story_id, row.reaction_type, row.count);
          });
        }
      } catch (err) {
        console.warn('Supabase reaction sync failed:', err);
        storyIds.forEach(storyId => types.forEach(type => setCount(storyId, type, '—')));
        document.querySelectorAll('.reaction-pill').forEach(button => { button.disabled = true; });
      }
    }

    async function handleReaction(btn, storyId, type) {
      if (!supabaseClient || btn.disabled) return;
      btn.classList.add('pop-bounce');
      setTimeout(() => btn.classList.remove('pop-bounce'), 450);
      btn.disabled = true;
      const countEl = btn.querySelector('.reaction-count');
      const alreadyVoted = hasUserReacted(storyId, type);
      try {
        const { data: dbCount, error } = await supabaseClient.rpc(
          alreadyVoted ? 'decrement_reaction' : 'increment_reaction',
          { p_story_id: storyId, p_reaction_type: type }
        );
        if (error || typeof dbCount !== 'number' || !Number.isFinite(dbCount)) {
          throw error || new Error('Invalid response from reaction service');
        }
        countEl.textContent = String(dbCount);
        if (alreadyVoted) {
          btn.classList.remove('voted');
          localStorage.removeItem(`voted_${storyId}_${type}`);
        } else {
          btn.classList.add('voted');
          localStorage.setItem(`voted_${storyId}_${type}`, 'true');
        }
      } catch (err) {
        console.warn('Reaction update failed:', err);
        countEl.textContent = '—';
        btn.disabled = true;
      } finally {
        if (countEl.textContent !== '—') btn.disabled = false;
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
