# Lesson visuals

New lessons can include up to two visuals beside the sections they explain. The tutor can return none when a topic does not benefit from them. Existing lesson versions do not change; regenerate to add visuals.

- Process diagrams use two to six ordered steps. Labels, formulas and IPA remain selectable text rendered by the existing notation component.
- At most one visual per lesson can be a raster illustration. It depicts a concept or scene without embedded labels or formulas. The caption carries exact notation. Quantitative graphs, exact anatomy, phonetic anatomy, geometry and chemical structures are excluded from raster generation.
- A separate vision review checks an illustration against its section and intended caption. Rejected images are omitted. This is an AI check, not a guarantee of factual accuracy; the existing lesson report/regenerate flow remains available.
- Notes remain self-contained when media is unavailable. Disabled image generation, exhausted quota, a timeout, a failed review or an upload failure do not discard the notes or process diagrams.

## Access and rollout

`LESSON_VISUALS_ACCESS` defaults to `all` while Nightklass is not monetized. Use `off` to stop new visual generation, or `allowlist` with comma-separated `LESSON_VISUALS_ALLOWED_USER_IDS` for a restricted rollout. Unknown values deny access. This is a server-side generation gate, **not a billing integration**. Connect `LessonVisualsService.canGenerate` to verified premium entitlements when subscriptions launch. Previously saved visuals remain readable by authorized lesson readers.

`LESSON_ILLUSTRATIONS_ENABLED=false` disables paid raster calls while keeping process diagrams. Illustrations use the existing `OPENAI_API_KEY`; the account must have access to the configured image model. No database migration is needed: media metadata lives in lesson JSON and files use existing private local/R2 storage.

## Storage and cost

Images are uploaded once, after review. Lesson JSON stores a storage key, never an expiring URL or the image prompt. Authorized learner and admin reads issue fresh one-hour signed links. The UI can refresh a failed image link by rereading the saved lesson, without generating another image. Deleting an account, course or permanently removed topic also removes its saved illustration files; archived topics retain their media. Admin corrections create a new version without copying potentially stale visuals; the original version keeps them.

The image request uses the pinned `gpt-image-2.5-sunburst-2026-09-08` model, medium quality, one 1024×1024 PNG, a 60-second timeout and no automatic retries. It reserves $0.25 through the existing durable AI quota before contacting the provider. Reported image/text tokens settle at the model's standard rates. A timeout or absent usage retains that conservative budget charge, since provider billing may have occurred. Review calls also use the existing quota and usage logs. Revisit rates when changing the model.

The integration and rates were checked on 2026-10-30 against the official [image API reference](https://developers.openai.com/api/reference/resources/images/methods/generate) and [model documentation](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst).

## Verification

Run `npm test --workspace=@assessiq/api` for model-output validation, quota ordering, private reads and failure handling. `npm run test:e2e:lessons --workspace=@assessiq/nightklass` runs desktop/mobile lesson UI checks using mocked API responses, without a database or paid generation. Live image quality and account/model access should also be checked in staging before release.
