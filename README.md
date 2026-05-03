# 粒子艺术系统 (Particle Art System)

一个交互式3D粒子艺术系统，支持手势识别和飞剑特效。通过摄像头追踪手势，控制粒子形状和飞剑运动，创造炫酷的视觉效果。

## ✨ 功能特性

### 🎨 粒子系统
- **6种预设形状**: 爱心、花朵、土星、佛像、烟花、球体
- **可自定义参数**: 
  - 粒子数量 (100-5000)
  - 粒子大小 (0.5-5)
  - 颜色选择器
- **平滑动画**: LERP插值实现流畅过渡

### ⚔️ 飞剑特效
- **精细3D建模**: 剑身、护手、剑柄、剑穗
- **三种状态**:
  - `idle`: 环绕飞行
  - `summoned`: 召唤到指尖
  - `flying`: 御剑飞行
- **粒子拖尾**: 动态光效和轨迹
- **可开关显示**

### 🤖 手势控制
支持多种手势识别：
- 🗡️ **剑指** - 召唤飞剑到指尖
- ✌️ **双指** - 御剑飞行
- ✊ **握拳** - 自动巡航
- 🖐️ **张开** - 粒子散射
- 👍 **拇指** - 加速旋转
- ✋ **移动手掌** - 粒子跟随
- 🔄 **旋转手腕** - 场景旋转

### 🎮 交互功能
- 实时摄像头追踪
- 全屏模式
- 截图保存
- 一键重置

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Three.js | r128 | 3D渲染引擎 |
| MediaPipe Hands | - | 手势识别 |
| Font Awesome | 6.5.1 | UI图标 |
| 原生JavaScript | ES6+ | 核心逻辑 |
| CSS3 | - | 样式设计 |

**特点**: 零依赖、零构建、开箱即用

## 📦 安装与运行

### 方式1: 直接打开
```bash
# 双击 index.html 文件
# 或在浏览器中打开
```

### 方式2: 本地服务器 (推荐)

**使用 Node.js:**
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 或仅启动服务器
npm start
```

**使用 Python:**
```bash
# Python 3
python -m http.server 8080

# 访问 http://localhost:8080
```

### 方式3: 使用任意静态服务器
```bash
# 例如使用 PHP 内置服务器
php -S localhost:8080
```

⚠️ **注意**: 摄像头功能需要 HTTPS 或 localhost 环境

## 🎯 使用指南

### 基本操作
1. 打开页面后，点击 **"启动摄像头"** 按钮
2. 允许浏览器访问摄像头权限
3. 将手放在摄像头前，系统会自动识别手势
4. 使用右侧控制面板调整参数

### 手势说明
| 手势 | 效果 | 说明 |
|------|------|------|
| 🗡️ 剑指 | 召唤飞剑 | 食指指向，飞剑飞向指尖 |
| ✌️ 双指 | 御剑飞行 | 食指和中指竖起，控制飞剑飞行 |
| ✊ 握拳 | 自动巡航 | 飞剑恢复环绕飞行 |
| 🖐️ 张开 | 粒子散射 | 手掌张开程度控制散射范围 |
| 👍 拇指 | 加速旋转 | 竖起拇指，粒子加速旋转 |

### 控制面板
- **模型选择**: 切换不同的粒子形状
- **飞剑控制**: 开启/关闭飞剑显示
- **粒子颜色**: 选择喜欢的颜色
- **粒子数量**: 调整粒子密度
- **粒子大小**: 调整粒子尺寸
- **手势灵敏度**: 调整手势响应速度

## 📁 项目结构

```
particle-art-system/
├── index.html              # 主入口文件
├── css/
│   └── styles.css          # 样式文件
├── js/
│   ├── main.js             # 入口脚本
│   ├── ParticleSystem.js   # 粒子系统主控制器
│   └── modules/            # 模块化子系统
│       ├── Config.js           # 配置管理
│       ├── SceneManager.js     # Three.js 场景管理
│       ├── ShapeGenerators.js  # 形状生成器
│       ├── SwordSystem.js      # 飞剑系统
│       ├── GestureRecognizer.js # 手势识别
│       ├── UIManager.js        # UI 控制
│       ├── ErrorManager.js     # 错误处理
│       └── PerformanceMonitor.js # 性能监控
├── package.json            # 项目配置
├── .gitignore             # Git忽略文件
└── README.md              # 项目文档
```

## 🔧 核心模块

### 1. 配置管理
所有配置集中在 `CONFIG` 对象中，包括：
- 粒子参数范围
- 动画速度
- 飞剑参数
- 手势防抖设置

### 2. 状态管理
使用单一状态树 `STATE` 管理运行时状态：
- Three.js 对象引用
- 粒子系统状态
- 飞剑状态
- 手势识别状态

### 3. 形状生成器
每个形状生成器都是纯函数：
```javascript
ModelGenerators.heart(count)    // 心形
ModelGenerators.flower(count)   // 花朵
ModelGenerators.saturn(count)   // 土星
ModelGenerators.buddha(count)   // 佛像
ModelGenerators.fireworks(count) // 烟花
ModelGenerators.sphere(count)   // 球体
```

### 4. 飞剑系统
- 3D建模: 剑身、护手、剑柄、剑穗
- 状态机: idle → summoned → flying
- 动画系统: LERP平滑、粒子拖尾

### 5. 手势识别
- MediaPipe Hands 实时追踪
- 手势分类算法
- 防抖处理 (3帧确认)

## 🎨 自定义扩展

### 添加新形状
在 `ModelGenerators` 对象中添加新的生成函数：

```javascript
ModelGenerators.star = function(count) {
    const positions = new Float32Array(count * 3);
    // 实现星星形状的粒子位置生成
    // ...
    return positions;
};
```

然后在 HTML 中添加对应的按钮：
```html
<button class="model-btn" data-model="star">
    <i class="fas fa-star"></i> 星星
</button>
```

### 添加新手势
在 `classifyGesture` 函数中添加新的手势识别逻辑：

```javascript
function classifyGesture(lm) {
    const fs = getFingerStates(lm);
    // 添加新的手势判断
    if (/* 你的条件 */) return 'new_gesture';
    // ...
}
```

## ⚡ 性能优化

项目已实现以下优化：
- ✅ Delta时间上限 (0.05秒)
- ✅ LERP平滑动画
- ✅ 防抖处理
- ✅ 对象复用
- ✅ 内存管理
- ✅ 帧率优化

## 🌐 浏览器兼容性

| 浏览器 | 版本要求 |
|--------|---------|
| Chrome | 最新2个版本 |
| Firefox | 最新2个版本 |
| Safari | 最新2个版本 |
| Edge | 最新2个版本 |

**必需功能**:
- WebGL 支持
- 摄像头 API (getUserMedia)
- ES6+ JavaScript

## 📝 开发计划

### 短期目标
- [ ] 添加更多粒子形状 (星星、螺旋、DNA)
- [ ] 支持双手手势
- [ ] 添加音效反馈
- [ ] 优化移动端体验

### 长期目标
- [ ] TypeScript 重构
- [ ] 单元测试覆盖
- [ ] VR/AR 支持
- [ ] 后端集成 (保存/分享)

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Three.js](https://threejs.org/) - 强大的3D渲染库
- [MediaPipe](https://mediapipe.dev/) - Google的手势识别框架
- [Font Awesome](https://fontawesome.com/) - 优秀的图标库

## 📧 联系方式

如有问题或建议，欢迎通过以下方式联系：
- 提交 Issue
- 发送邮件

---

⭐ 如果这个项目对你有帮助，请给一个 Star！
