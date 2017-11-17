"use strict";

let del = require("del");
let gulp = require("gulp");
let merge2 = require("merge2");
let sourcemaps = require("gulp-sourcemaps");
let typescript = require("gulp-typescript");

gulp.task("default", ["prod"]);

gulp.task("clean", function() {
    return del("dist");
});

let project = typescript.createProject("tsconfig.json");

gulp.task("copy-deps", ["clean"], function() {
    gulp.src("config.json")
        .pipe(gulp.dest("dist"));
});

gulp.task("prod", ["copy-deps"], function() {
    return project.src()
        .pipe(project(typescript.reporter.defaultReporter()))
        .on("error", function() {
            this.on("finish", function() {
                process.exit(1);
            });
        })
        .js
        .pipe(gulp.dest("dist"))
});

gulp.task("dev", ["copy-deps"], function() {
    return project.src()
        .pipe(sourcemaps.init())
        .pipe(project(typescript.reporter.defaultReporter()))
        .on("error", function() {
            this.on("finish", function() {
                process.exit(1);
            });
        })
        .js
        .pipe(sourcemaps.write())
        .pipe(gulp.dest("dist"))
});