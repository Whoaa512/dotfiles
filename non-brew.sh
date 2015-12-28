#!/usr/bin/env bash
git clone https://github.com/tj/n.git
cd n && make install
cd -
echo "Please pick a node version with n"
