.. Connext documentation master file, created by
   sphinx-quickstart on Wed Apr  3 12:06:15 2019.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Connext Documentation
===================================

Connext is an infrastructure layer on top of Ethereum that lets Ethereum wallets, applications and protocols do instant, high volume transactions with arbitrarily complex conditions for settlement. Projects that integrate Connext can enable users to batch up Ethereum interactions to get more transaction throughput per block.

These docs cover both the background of Connext and how to get started integrating Connext into your Ethereum wallet or application.

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

*********
Community
*********

`Join the community 
<https://discord.gg/raNmNb5>`_ to meet the team, discuss development, and hang out!


""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

*********
Contents
*********

.. toctree::
    :maxdepth: 2
    :caption: Quick Start

    quickstart/introduction
    quickstart/basics
    quickstart/clientInstantiation
    quickstart/fundingYourChannel
    quickstart/advanced

.. toctree::
    :maxdepth: 2
    :caption: Background

    background/architecture
    background/protocol
    background/protocol-diagrams
    background/limitations
    background/faq

.. toctree::
    :maxdepth: 2
    :caption: Guides

    how-to/deploy-indra
    how-to/integrate-browser
    how-to/integrate-react-native
    how-to/integrate-node

.. toctree::
    :maxdepth: 2
    :caption: API Reference

    reference/cf-core
    reference/client
    reference/store
    reference/types
    reference/utils

.. toctree::
    :maxdepth: 2
    :caption: Contributor Documentation

    contributor/CONTRIBUTING
    contributor/workflow-protocols
    contributor/meta
