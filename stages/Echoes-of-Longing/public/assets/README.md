# 素材目录

音频与图片素材放置于此，随仓库一同提交并参与构建。素材缺失时页面自动降级为纯代码视觉（静默排演模式仍可完整空放整场）。

## 放置约定

```
assets/
  audio/
    echoes-of-longing.mp3   ← 音源（也接受 .ogg / .m4a，或 song.mp3）
  img/
    （任意图片：官方立绘、CG 截图、专辑封面、手写素材……）
```

- **音频**：页面启动时按上述文件名探测并直接播放；找不到时点击光环后自动静默排演。
- **图片**：文件名不限，由各 cut 通过 `fx/imagePlane.js` 按路径引用（例如 `assets/img/malkuth.png`），获得视差 / 噪声溶解 / RGB 分离等处理。素材缺失时 `loadImagePlane` 返回 `null`，cut 据此降级。
