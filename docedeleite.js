import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '/config.js';


const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const doceDeLeiteAPI = {
    auth: {
        async login(email, password) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data;
        },
        async logout() {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return true;
        },
        async getSessaoAtual() {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            return session;
        }
    },

    posts: {
        async criar(titulo) {
            const session = await doceDeLeiteAPI.auth.getSessaoAtual();
            if (!session || !session.user) throw new Error("Usuário não autenticado.");

            const { data, error } = await supabase
                .from('posts')
                .insert([{ title: titulo, creator: session.user.id }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async curtir(postId) {
            const session = await doceDeLeiteAPI.auth.getSessaoAtual();
            if (!session || !session.user) throw new Error("Usuário não autenticado.");

            const { data: post, error: fetchError } = await supabase
                .from('posts')
                .select('like')
                .eq('id', postId)
                .single();

            if (fetchError) throw fetchError;

            let likes = post.like || [];
            const userId = session.user.id;

            if (likes.includes(userId)) {
                likes = likes.filter(id => id !== userId);
            } else {
                likes.push(userId);
            }

            const { data, error: updateError } = await supabase
                .from('posts')
                .update({ like: likes })
                .eq('id', postId)
                .select()
                .single();

            if (updateError) throw updateError;
            return data;
        },

        async comentar(postId, texto) {
            const session = await doceDeLeiteAPI.auth.getSessaoAtual();
            if (!session || !session.user) throw new Error("Usuário não autenticado.");

            const { data: perfil } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', session.user.id)
                .single();

            const username = perfil ? perfil.username : 'usuario';

            const { data: post, error: fetchError } = await supabase
                .from('posts')
                .select('comments')
                .eq('id', postId)
                .single();

            if (fetchError) throw fetchError;

            let comentarios = post.comments || [];
            comentarios.push({
                user_id: session.user.id,
                username: username,
                text: texto,
                created_at: new Date().toISOString()
            });

            const { data, error: updateError } = await supabase
                .from('posts')
                .update({ comments: comentarios })
                .eq('id', postId)
                .select()
                .single();

            if (updateError) throw updateError;
            return data;
        }
    },

    perfil: {
        async atualizar(dados) {
            const session = await doceDeLeiteAPI.auth.getSessaoAtual();
            if (!session || !session.user) throw new Error("Usuário não autenticado.");

            const payload = {};
            if (dados.display_name !== undefined) payload.display_name = dados.display_name;
            if (dados.username !== undefined) payload.username = dados.username.toLowerCase().replace('@', '');
            if (dados.bio !== undefined) payload.bio = dados.bio;
            if (dados.avatar_url !== undefined) payload.avatar_url = dados.avatar_url;

            const { data, error } = await supabase
                .from('profiles')
                .update(payload)
                .eq('id', session.user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async seguir(perfilIdAlvo) {
            const session = await doceDeLeiteAPI.auth.getSessaoAtual();
            if (!session || !session.user) throw new Error("Usuário não autenticado.");
            
            const meuId = session.user.id;
            if (meuId === perfilIdAlvo) throw new Error("Você não pode seguir a si mesmo.");

            const { data: alvo, error: fetchError } = await supabase
                .from('profiles')
                .select('followers')
                .eq('id', perfilIdAlvo)
                .single();

            if (fetchError) throw fetchError;

            let seguidores = alvo.followers || [];
            if (seguidores.includes(meuId)) {
                seguidores = seguidores.filter(id => id !== meuId);
            } else {
                seguidores.push(meuId);
            }

            const { data, error: updateError } = await supabase
                .from('profiles')
                .update({ followers: seguidores })
                .eq('id', perfilIdAlvo)
                .select()
                .single();

            if (updateError) throw updateError;
            return data;
        }
    }
};
