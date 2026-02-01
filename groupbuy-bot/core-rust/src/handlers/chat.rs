use actix_web::{web, HttpResponse};
use sqlx::PgPool;

use crate::models::chat::*;

/// GET /api/chat/messages/?procurement=...
pub async fn list_messages(
    pool: web::Data<PgPool>,
    query: web::Query<MessageQuery>,
) -> HttpResponse {
    let messages = if let Some(procurement_id) = query.procurement {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM chat_messages WHERE procurement_id = $1 AND is_deleted = false ORDER BY created_at ASC",
        )
        .bind(procurement_id)
        .fetch_all(pool.get_ref())
        .await
    } else {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM chat_messages WHERE is_deleted = false ORDER BY created_at ASC LIMIT 100",
        )
        .fetch_all(pool.get_ref())
        .await
    };

    match messages {
        Ok(msgs) => HttpResponse::Ok().json(serde_json::json!({"results": msgs})),
        Err(e) => {
            tracing::error!("Failed to fetch messages: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}

/// POST /api/chat/messages/
pub async fn create_message(
    pool: web::Data<PgPool>,
    body: web::Json<CreateMessage>,
) -> HttpResponse {
    let data = body.into_inner();
    let message_type = data.message_type.unwrap_or_else(|| "text".to_string());
    let attachment_url = data.attachment_url.unwrap_or_default();

    match sqlx::query_as::<_, Message>(
        r#"INSERT INTO chat_messages (procurement_id, user_id, message_type, text, attachment_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *"#,
    )
    .bind(data.procurement)
    .bind(data.user)
    .bind(&message_type)
    .bind(&data.text)
    .bind(&attachment_url)
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(message) => HttpResponse::Created().json(message),
        Err(e) => {
            tracing::error!("Failed to create message: {}", e);
            HttpResponse::BadRequest().json(serde_json::json!({"error": format!("{}", e)}))
        }
    }
}

/// GET /api/chat/notifications/?user=...
pub async fn list_notifications(
    pool: web::Data<PgPool>,
    query: web::Query<NotificationQuery>,
) -> HttpResponse {
    let notifications = if let Some(user_id) = query.user {
        sqlx::query_as::<_, Notification>(
            "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await
    } else {
        sqlx::query_as::<_, Notification>(
            "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100",
        )
        .fetch_all(pool.get_ref())
        .await
    };

    match notifications {
        Ok(notifs) => HttpResponse::Ok().json(notifs),
        Err(e) => {
            tracing::error!("Failed to fetch notifications: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}
